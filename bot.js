const mineflayer = require('mineflayer');
const TelegramBot = require('node-telegram-bot-api');
const { createServer } = require('net');

const TOKEN = process.env.BOT_TOKEN || 'YOUR_TOKEN';
const tg = new TelegramBot(TOKEN, { polling: true });

// ===== STATE =====
const mcBots = {};        // key -> { bot, host, port, chatId, startTime, reconnects, stopped }
const notifications = {}; // chatId -> true/false (تنبيهات مفعّلة؟)
const serverMonitors = {}; // key -> interval

console.log('🤖 fxlbot started');

// ===== HELPERS =====
function botKey(chatId, host, port) {
  return `${chatId}|${host}|${port}`;
}

function uptime(startTime) {
  const s = Math.floor((Date.now() - startTime) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}س ${m}د`;
  if (m > 0) return `${m}د ${sec}ث`;
  return `${sec}ث`;
}

function notifEnabled(chatId) {
  return notifications[chatId] !== false; // افتراضي: مفعّل
}

function sendNotif(chatId, text) {
  if (notifEnabled(chatId)) {
    tg.sendMessage(chatId, text, { parse_mode: 'Markdown' }).catch(() => {});
  }
}

async function pingServer(host, port) {
  return new Promise((resolve) => {
    const socket = require('net').createConnection({ host, port, timeout: 5000 });
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
  });
}

// ===== /start =====
tg.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  notifications[chatId] = true;
  tg.sendMessage(chatId,
    `⛏️ *fxlbot — Minecraft AFK Bot*\n\n` +
    `*أوامر البوتات:*\n` +
    `▶️ \`/add <ip> <port>\` — إضافة بوت\n` +
    `⏹ \`/remove <ip> <port>\` — إزالة بوت\n` +
    `📋 \`/list\` — قائمة البوتات\n\n` +
    `*أوامر المراقبة:*\n` +
    `📊 \`/status <ip> <port>\` — حالة السيرفر\n` +
    `👁 \`/watch <ip> <port>\` — مراقبة تلقائية\n` +
    `🚫 \`/unwatch <ip> <port>\` — إيقاف المراقبة\n\n` +
    `*إعدادات:*\n` +
    `🔔 \`/notif on\` — تفعيل التنبيهات\n` +
    `🔕 \`/notif off\` — إيقاف التنبيهات\n` +
    `❓ \`/help\` — المساعدة`,
    { parse_mode: 'Markdown' }
  );
});

// ===== /help =====
tg.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  tg.sendMessage(chatId,
    `📖 *دليل الاستخدام*\n\n` +
    `*إضافة بوت للسيرفر:*\n` +
    `\`/add 157.90.205.62 26072\`\n\n` +
    `*إزالة بوت:*\n` +
    `\`/remove 157.90.205.62 26072\`\n\n` +
    `*مراقبة سيرفر (تنبيه إذا طاف):*\n` +
    `\`/watch 157.90.205.62 26072\`\n\n` +
    `*إيقاف التنبيهات المزعجة:*\n` +
    `\`/notif off\`\n\n` +
    `*ملاحظة:* تقدر تضيف أكثر من بوت بنفس الوقت`,
    { parse_mode: 'Markdown' }
  );
});

// ===== /add =====
tg.onText(/\/add (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const args = match[1].trim().split(/\s+/);
  const host = args[0];
  const port = parseInt(args[1]) || 25565;

  if (!host) {
    tg.sendMessage(chatId, '❌ الاستخدام: `/add <ip> <port>`', { parse_mode: 'Markdown' });
    return;
  }

  const key = botKey(chatId, host, port);
  if (mcBots[key] && !mcBots[key].stopped) {
    tg.sendMessage(chatId, `⚠️ بوت متصل بالفعل بـ \`${host}:${port}\``, { parse_mode: 'Markdown' });
    return;
  }

  tg.sendMessage(chatId, `⏳ جاري الاتصال بـ \`${host}:${port}\`...`, { parse_mode: 'Markdown' });
  launchBot(chatId, host, port, key);
});

// ===== /remove =====
tg.onText(/\/remove (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const args = match[1].trim().split(/\s+/);
  const host = args[0];
  const port = parseInt(args[1]) || 25565;
  const key = botKey(chatId, host, port);

  if (!mcBots[key]) {
    tg.sendMessage(chatId, `❌ لا يوجد بوت متصل بـ \`${host}:${port}\``, { parse_mode: 'Markdown' });
    return;
  }

  mcBots[key].stopped = true;
  try { mcBots[key].bot?.quit(); } catch(e) {}
  delete mcBots[key];
  tg.sendMessage(chatId, `⏹ تم إيقاف البوت من \`${host}:${port}\``, { parse_mode: 'Markdown' });
});

// ===== /list =====
tg.onText(/\/list/, (msg) => {
  const chatId = msg.chat.id;
  const myBots = Object.entries(mcBots).filter(([k]) => k.startsWith(`${chatId}|`));

  if (myBots.length === 0) {
    tg.sendMessage(chatId, '📋 لا يوجد بوتات متصلة حالياً\n\nاستخدم `/add <ip> <port>` لإضافة بوت', { parse_mode: 'Markdown' });
    return;
  }

  let text = `📋 *البوتات المتصلة (${myBots.length}):*\n\n`;
  myBots.forEach(([key, data]) => {
    const status = data.connected ? '🟢 متصل' : '🔴 غير متصل';
    const ut = data.startTime ? uptime(data.startTime) : 'غير معروف';
    text += `${status} \`${data.host}:${data.port}\`\n`;
    text += `   ⏱ وقت الاتصال: ${ut}\n`;
    text += `   🔄 إعادة اتصال: ${data.reconnects || 0} مرة\n\n`;
  });

  const notifStatus = notifEnabled(chatId) ? '🔔 مفعّلة' : '🔕 موقوفة';
  text += `التنبيهات: ${notifStatus}`;
  tg.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// ===== /status =====
tg.onText(/\/status (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const args = match[1].trim().split(/\s+/);
  const host = args[0];
  const port = parseInt(args[1]) || 25565;

  const loadMsg = await tg.sendMessage(chatId, `⏳ جاري فحص \`${host}:${port}\`...`, { parse_mode: 'Markdown' });

  try {
    const { JavaServer } = require('minecraft-server-util');
    const result = await JavaServer.status(host, port, { timeout: 8000 });
    const online = result.players.online;
    const max = result.players.max;
    const fill = max > 0 ? Math.round((online / max) * 10) : 0;
    const bar = '█'.repeat(fill) + '░'.repeat(10 - fill);
    const pct = max > 0 ? Math.round((online / max) * 100) : 0;

    tg.editMessageText(
      `✅ *السيرفر متصل!*\n\n` +
      `🌐 \`${host}:${port}\`\n` +
      `━━━━━━━━━━━━━━\n` +
      `📟 الإصدار: \`${result.version.name}\`\n` +
      `📶 Ping: \`${Math.round(result.roundTripLatency)} ms\`\n` +
      `━━━━━━━━━━━━━━\n` +
      `👤 اللاعبون: \`${online}/${max}\`\n` +
      `📊 \`[${bar}]\` ${pct}%`,
      { chat_id: chatId, message_id: loadMsg.message_id, parse_mode: 'Markdown' }
    );
  } catch(e) {
    tg.editMessageText(
      `❌ *السيرفر غير متاح*\n\`${host}:${port}\``,
      { chat_id: chatId, message_id: loadMsg.message_id, parse_mode: 'Markdown' }
    );
  }
});

// ===== /watch =====
tg.onText(/\/watch (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const args = match[1].trim().split(/\s+/);
  const host = args[0];
  const port = parseInt(args[1]) || 25565;
  const key = `watch|${chatId}|${host}|${port}`;

  if (serverMonitors[key]) {
    tg.sendMessage(chatId, `👁 بالفعل تراقب \`${host}:${port}\``, { parse_mode: 'Markdown' });
    return;
  }

  let lastState = null;
  let offlineCount = 0;

  tg.sendMessage(chatId, `👁 بدأت مراقبة \`${host}:${port}\` كل دقيقة`, { parse_mode: 'Markdown' });

  serverMonitors[key] = setInterval(async () => {
    const isOnline = await pingServer(host, port);

    if (lastState === null) { lastState = isOnline; return; }

    if (!isOnline && lastState) {
      // طاف للتو
      offlineCount++;
      if (offlineCount === 1) {
        sendNotif(chatId, `🔴 *السيرفر طاف!*\n\`${host}:${port}\``);
      }
      lastState = false;
    } else if (isOnline && !lastState) {
      // رجع
      offlineCount = 0;
      sendNotif(chatId, `🟢 *السيرفر رجع!*\n\`${host}:${port}\``);
      lastState = true;
    }
  }, 60000);
});

// ===== /unwatch =====
tg.onText(/\/unwatch (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const args = match[1].trim().split(/\s+/);
  const host = args[0];
  const port = parseInt(args[1]) || 25565;
  const key = `watch|${chatId}|${host}|${port}`;

  if (serverMonitors[key]) {
    clearInterval(serverMonitors[key]);
    delete serverMonitors[key];
    tg.sendMessage(chatId, `🚫 توقفت عن مراقبة \`${host}:${port}\``, { parse_mode: 'Markdown' });
  } else {
    tg.sendMessage(chatId, `❌ لا توجد مراقبة لـ \`${host}:${port}\``, { parse_mode: 'Markdown' });
  }
});

// ===== /notif =====
tg.onText(/\/notif (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const val = match[1].trim().toLowerCase();

  if (val === 'off' || val === 'false' || val === '0') {
    notifications[chatId] = false;
    tg.sendMessage(chatId, '🔕 *التنبيهات موقوفة*\nلن تصلك رسائل مزعجة', { parse_mode: 'Markdown' });
  } else if (val === 'on' || val === 'true' || val === '1') {
    notifications[chatId] = true;
    tg.sendMessage(chatId, '🔔 *التنبيهات مفعّلة*', { parse_mode: 'Markdown' });
  }
});

// ===== MC BOT ENGINE =====
function launchBot(chatId, host, port, key) {
  let reconnectDelay = 10000; // 10 ثانية بين كل محاولة
  let antiAFKInterval;
  let loginAttempted = false;

  const state = {
    host, port, chatId,
    connected: false,
    startTime: null,
    reconnects: 0,
    stopped: false,
    bot: null,
  };
  mcBots[key] = state;

  function createBot() {
    if (state.stopped) return;

    loginAttempted = false;

    const bot = mineflayer.createBot({
      host,
      port,
      username: 'fxlbot',
      auth: 'offline',
      version: false,
      keepAlive: true,
      checkTimeoutInterval: 60000,
      connect: (client) => {
        client.socket.setKeepAlive(true, 30000);
      }
    });

    state.bot = bot;

    bot.on('login', () => {
      state.connected = true;
      state.startTime = Date.now();
      reconnectDelay = 10000;
      console.log(`✅ fxlbot دخل ${host}:${port}`);
      sendNotif(chatId, `✅ *fxlbot دخل السيرفر*\n\`${host}:${port}\``);
    });

    bot.on('spawn', () => {
      // تسجيل دخول مرة واحدة فقط
      if (!loginAttempted) {
        loginAttempted = true;
        setTimeout(() => {
          try { bot.chat('/register fxlbot123 fxlbot123'); } catch(e) {}
          setTimeout(() => {
            try { bot.chat('/login fxlbot123'); } catch(e) {}
          }, 3000);
        }, 4000);
      }

      // Anti-AFK
      if (antiAFKInterval) clearInterval(antiAFKInterval);
      antiAFKInterval = setInterval(() => {
        if (!bot?.entity || state.stopped) return;
        try {
          // تحرك بسيط
          const moves = ['forward', 'back', 'left', 'right'];
          const move = moves[Math.floor(Math.random() * moves.length)];
          bot.setControlState(move, true);
          setTimeout(() => { try { bot.setControlState(move, false); } catch(e){} }, 600);

          // نظر عشوائي
          bot.look(Math.random() * Math.PI * 2, 0, true);

          // قفز أحياناً
          if (Math.random() > 0.7) {
            bot.setControlState('jump', true);
            setTimeout(() => { try { bot.setControlState('jump', false); } catch(e){} }, 400);
          }
        } catch(e) {}
      }, 25000); // كل 25 ثانية
    });

    bot.on('kicked', (reason) => {
      state.connected = false;
      if (antiAFKInterval) clearInterval(antiAFKInterval);
      const r = typeof reason === 'string' ? reason.replace(/§./g, '').slice(0, 80) : 'غير معروف';
      console.log(`⚠️ fxlbot طُرد: ${r}`);
      if (!state.stopped) {
        state.reconnects++;
        sendNotif(chatId, `⚠️ *fxlbot طُرد*\n\`${host}:${port}\`\nالسبب: ${r}\n⏳ إعادة اتصال خلال ${reconnectDelay/1000}ث`);
        scheduleReconnect();
      }
    });

    bot.on('end', (reason) => {
      state.connected = false;
      if (antiAFKInterval) clearInterval(antiAFKInterval);
      if (!state.stopped) {
        state.reconnects++;
        console.log(`🔌 انقطع: ${reason}`);
        scheduleReconnect();
      }
    });

    bot.on('error', (err) => {
      state.connected = false;
      if (antiAFKInterval) clearInterval(antiAFKInterval);
      console.log(`❌ خطأ: ${err.message}`);
      if (!state.stopped) {
        state.reconnects++;
        scheduleReconnect();
      }
    });
  }

  function scheduleReconnect() {
    if (state.stopped) return;
    setTimeout(() => {
      if (!state.stopped) {
        console.log(`🔄 إعادة اتصال ${host}:${port} (محاولة ${state.reconnects})`);
        createBot();
      }
      // زيادة تدريجية للتأخير
      reconnectDelay = Math.min(reconnectDelay * 1.5, 120000); // max 2 دقيقة
    }, reconnectDelay);
  }

  createBot();
}

tg.on('polling_error', (err) => console.log('Polling error:', err.message));
console.log('✅ Bot ready!');
