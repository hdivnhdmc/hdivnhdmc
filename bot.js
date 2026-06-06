const mineflayer = require('mineflayer');
const TelegramBot = require('node-telegram-bot-api');

const TOKEN = process.env.BOT_TOKEN || 'YOUR_TOKEN';
const tg = new TelegramBot(TOKEN, { polling: true });

// قائمة البوتات الشغّالة
const activeBots = {};

console.log('🤖 Telegram Bot + MC Bot started');

// ===== /start =====
tg.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  tg.sendMessage(chatId,
    `🎮 *fxlbot - Minecraft AFK Bot*\n\n` +
    `الأوامر:\n` +
    `▶️ \`/connect <ip> <port>\` — دخول سيرفر\n` +
    `⏹ \`/disconnect\` — قطع الاتصال\n` +
    `📊 \`/bots\` — البوتات الشغّالة`,
    { parse_mode: 'Markdown' }
   tg.onText(/\/stop/, (msg) => {
  const chatId = msg.chat.id;

  Object.keys(activeBots).forEach(key => {
    if (key.startsWith(`${chatId}_`)) {
      stoppedBots[key] = true;

      try {
        activeBots[key].bot.quit();
      } catch(e) {}

      delete activeBots[key];
    }
  });

  tg.sendMessage(chatId, '⏹ تم إيقاف البوت نهائياً');
});
      );
});

// ===== /connect =====
tg.onText(/\/connect (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const args = match[1].trim().split(/\s+/);
  const host = args[0];
  const port = parseInt(args[1]) || 25565;

  if (!host) {
    tg.sendMessage(chatId, '❌ الاستخدام: `/connect <ip> <port>`', { parse_mode: 'Markdown' });
    return;
  }

  const key = `${chatId}_${host}_${port}`;

  if (activeBots[key]) {
    tg.sendMessage(chatId, `⚠️ fxlbot بالفعل متصل بـ \`${host}:${port}\``, { parse_mode: 'Markdown' });
    return;
  }

  tg.sendMessage(chatId, `⏳ fxlbot يتصل بـ \`${host}:${port}\`...`, { parse_mode: 'Markdown' });

  startMCBot(chatId, host, port, key);
});

// ===== /disconnect =====
tg.onText(/\/disconnect/, (msg) => {
  const chatId = msg.chat.id;
  const keys = Object.keys(activeBots).filter(k => k.startsWith(`${chatId}_`));

  if (keys.length === 0) {
    tg.sendMessage(chatId, '❌ لا يوجد بوت متصل حالياً');
    return;
  }

  keys.forEach(key => {
    try { activeBots[key].bot.quit(); } catch(e) {}
    delete activeBots[key];
  });

  tg.sendMessage(chatId, '⏹ تم قطع اتصال fxlbot');
});

// ===== /bots =====
tg.onText(/\/bots/, (msg) => {
  const chatId = msg.chat.id;
  const keys = Object.keys(activeBots).filter(k => k.startsWith(`${chatId}_`));

  if (keys.length === 0) {
    tg.sendMessage(chatId, '📊 لا يوجد بوت متصل حالياً');
    return;
  }

  let text = '📊 *البوتات الشغّالة:*\n\n';
  keys.forEach(key => {
    const parts = key.split('_');
    text += `🟢 \`${parts[1]}:${parts[2]}\`\n`;
  });

  tg.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// ===== MC Bot Logic =====
function startMCBot(chatId, host, port, key) {
  let reconnectDelay = 5000;
  let antiAFKInterval;
  let stopped = false;

  function createBot() {
    if (stopped) return;

    const bot = mineflayer.createBot({
      host,
      port,
      username: 'fxlbot','fxlbot2', 
      auth: 'offline',
      version: 1.21.11,
      keepAlive: true,
      checkTimeoutInterval: 30000,
    });

    activeBots[key] = { bot, stop: () => { stopped = true; bot.quit(); } };

    bot.on('login', () => {
      console.log(`✅ fxlbot دخل ${host}:${port}`);
      reconnectDelay = 5000;
      tg.sendMessage(chatId, `✅ *fxlbot دخل السيرفر!*\n🌐 \`${host}:${port}\``, { parse_mode: 'Markdown' });
    });

    bot.on('spawn', () => {
      // Auto login للسيرفرات اللي تطلب تسجيل
      setTimeout(() => {
        try { bot.chat('/register fxlbot123 fxlbot123'); } catch(e) {}
        setTimeout(() => {
          try { bot.chat('/login fxlbot123'); } catch(e) {}
        }, 2000);
      }, 3000);

      // Anti-AFK
      if (antiAFKInterval) clearInterval(antiAFKInterval);
      antiAFKInterval = setInterval(() => {
        if (!bot?.entity) return;
        try {
          const moves = ['forward', 'back', 'left', 'right'];
          const move = moves[Math.floor(Math.random() * moves.length)];
          bot.setControlState(move, true);
          setTimeout(() => { try { bot.setControlState(move, false); } catch(e){} }, 500);
          if (Math.random() > 0.6) {
            bot.setControlState('jump', true);
            setTimeout(() => { try { bot.setControlState('jump', false); } catch(e){} }, 300);
          }
        } catch(e) {}
      }, 30000);
    });

    bot.on('kicked', (reason) => {
      if (antiAFKInterval) clearInterval(antiAFKInterval);
      const r = typeof reason === 'string' ? reason : JSON.stringify(reason);
      tg.sendMessage(chatId, `⚠️ fxlbot تم طرده\nالسبب: ${r.slice(0,100)}\n⏳ إعادة اتصال...`);
      delete activeBots[key];
      setTimeout(() => { reconnectDelay = Math.min(reconnectDelay * 1.5, 60000); createBot(); }, reconnectDelay);
    });

    bot.on('end', () => {
      if (stopped) return;
      if (antiAFKInterval) clearInterval(antiAFKInterval);
      delete activeBots[key];
      setTimeout(() => { reconnectDelay = Math.min(reconnectDelay * 1.5, 60000); createBot(); }, reconnectDelay);
    });

    bot.on('error', (err) => {
      console.log(`❌ ${err.message}`);
      if (antiAFKInterval) clearInterval(antiAFKInterval);
      delete activeBots[key];
      if (!stopped) {
        tg.sendMessage(chatId, `❌ خطأ في الاتصال: ${err.message.slice(0,80)}\n⏳ إعادة اتصال...`);
        setTimeout(() => { reconnectDelay = Math.min(reconnectDelay * 1.5, 60000); createBot(); }, reconnectDelay);
      }
    });
  }

  createBot();
}
