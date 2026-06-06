const mineflayer = require('mineflayer');
const TelegramBot = require('node-telegram-bot-api');

const TOKEN = process.env.BOT_TOKEN || 'YOUR_TOKEN';
const tg = new TelegramBot(TOKEN, { polling: true });

const activeBots = {};
const stoppedBots = {};

console.log('🤖 Telegram Bot + MC Bot started');

// ===== /start =====
tg.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  tg.sendMessage(
    chatId,
    `🎮 *fxlbot - Minecraft AFK Bot*\n\n` +
    `الأوامر:\n` +
    `▶️ /connect <ip> <port> — دخول سيرفر\n` +
    `⏹ /disconnect — قطع الاتصال\n` +
    `🛑 /stop — إيقاف البوت نهائياً\n` +
    `📊 /bots — البوتات الشغالة`,
    { parse_mode: 'Markdown' }
  );
});

// ===== /stop =====
tg.onText(/\/stop/, (msg) => {
  const chatId = msg.chat.id;

  Object.keys(activeBots).forEach(key => {
    if (key.startsWith(`${chatId}_`)) {
      stoppedBots[key] = true;

      try {
        activeBots[key].bot.quit();
      } catch (e) {}

      delete activeBots[key];
    }
  });

  tg.sendMessage(chatId, '🛑 تم إيقاف البوت نهائياً');
});

// ===== /connect =====
tg.onText(/\/connect (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const args = match[1].trim().split(/\s+/);

  const host = args[0];
  const port = parseInt(args[1]) || 25565;

  if (!host) {
    tg.sendMessage(chatId, '❌ الاستخدام: /connect <ip> <port>');
    return;
  }

  const key = `${chatId}_${host}_${port}`;

  delete stoppedBots[key];

  if (activeBots[key]) {
    tg.sendMessage(chatId, `⚠️ البوت متصل بالفعل بـ ${host}:${port}`);
    return;
  }

  tg.sendMessage(chatId, `⏳ جاري الاتصال بـ ${host}:${port} ...`);

  startMCBot(chatId, host, port, key);
});

// ===== /disconnect =====
tg.onText(/\/disconnect/, (msg) => {
  const chatId = msg.chat.id;

  const keys = Object.keys(activeBots).filter(k =>
    k.startsWith(`${chatId}_`)
  );

  if (keys.length === 0) {
    tg.sendMessage(chatId, '❌ لا يوجد بوت متصل');
    return;
  }

  keys.forEach(key => {
    try {
      activeBots[key].bot.quit();
    } catch (e) {}

    delete activeBots[key];
  });

  tg.sendMessage(chatId, '⏹ تم قطع الاتصال');
});

// ===== /bots =====
tg.onText(/\/bots/, (msg) => {
  const chatId = msg.chat.id;

  const keys = Object.keys(activeBots).filter(k =>
    k.startsWith(`${chatId}_`)
  );

  if (keys.length === 0) {
    tg.sendMessage(chatId, '📊 لا يوجد بوت متصل');
    return;
  }

  let text = '📊 البوتات الشغالة:\n\n';

  keys.forEach(key => {
    const parts = key.split('_');
    text += `🟢 ${parts[1]}:${parts[2]}\n`;
  });

  tg.sendMessage(chatId, text);
});

// ===== MC BOT =====
function startMCBot(chatId, host, port, key) {
  let reconnectDelay = 5000;
  let antiAFKInterval = null;
  let reconnecting = false;
  let stopped = false;

  function reconnect() {
    if (stoppedBots[key] || reconnecting) return;

    reconnecting = true;

    setTimeout(() => {
      reconnecting = false;
      createBot();
    }, reconnectDelay);

    reconnectDelay = Math.min(reconnectDelay * 1.5, 60000);
  }

  function createBot() {
    if (stoppedBots[key] || stopped) return;

    const bot = mineflayer.createBot({
      host,
      port,
      username: 'fxlbot',
      auth: 'offline',
      version: '1.21.11',
      keepAlive: true,
      checkTimeoutInterval: 30000
    });

    activeBots[key] = {
      bot,
      stop: () => {
        stopped = true;
        bot.quit();
      }
    };

    bot.on('login', () => {
      console.log(`✅ Connected ${host}:${port}`);
      reconnectDelay = 5000;

      if (!stoppedBots[key]) {
        tg.sendMessage(
          chatId,
          `✅ fxlbot دخل السيرفر\n🌐 ${host}:${port}`
        );
      }
    });

    bot.on('spawn', () => {
      setTimeout(() => {
        try {
          bot.chat('/register fxlbot123 fxlbot123');
        } catch {}

        setTimeout(() => {
          try {
            bot.chat('/login fxlbot123');
          } catch {}
        }, 2000);
      }, 3000);

      if (antiAFKInterval) {
        clearInterval(antiAFKInterval);
      }

      antiAFKInterval = setInterval(() => {
        if (!bot.entity) return;

        try {
          const moves = ['forward', 'back', 'left', 'right'];

          const move =
            moves[Math.floor(Math.random() * moves.length)];

          bot.setControlState(move, true);

          setTimeout(() => {
            try {
              bot.setControlState(move, false);
            } catch {}
          }, 500);

          if (Math.random() > 0.6) {
            bot.setControlState('jump', true);

            setTimeout(() => {
              try {
                bot.setControlState('jump', false);
              } catch {}
            }, 300);
          }
        } catch {}
      }, 30000);
    });

    bot.on('kicked', (reason) => {
      if (antiAFKInterval) {
        clearInterval(antiAFKInterval);
      }

      delete activeBots[key];

      if (stoppedBots[key]) return;

      const r =
        typeof reason === 'string'
          ? reason
          : JSON.stringify(reason);

      tg.sendMessage(
        chatId,
        `⚠️ تم طرد البوت\nالسبب: ${r.slice(0, 100)}`
      );

      reconnect();
    });

    bot.on('end', () => {
      if (antiAFKInterval) {
        clearInterval(antiAFKInterval);
      }

      delete activeBots[key];

      if (stoppedBots[key]) return;

      reconnect();
    });

    bot.on('error', (err) => {
      console.log(err);

      if (antiAFKInterval) {
        clearInterval(antiAFKInterval);
      }

      delete activeBots[key];

      if (stoppedBots[key]) return;

      tg.sendMessage(
        chatId,
        `❌ خطأ: ${err.message}`
      );

      reconnect();
    });
  }

  createBot();
  }
