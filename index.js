const mineflayer = require('mineflayer');

const HOST = process.env.MC_HOST || 'localhost';
const PORT = parseInt(process.env.MC_PORT || '25565');
const USERNAME = process.env.MC_USERNAME || 'fxlbot';

console.log(`🤖 fxlbot - Minecraft AFK Bot`);
console.log(`📡 Connecting to ${HOST}:${PORT} as ${USERNAME}`);

let bot;
let reconnectDelay = 5000;

function createBot() {
  bot = mineflayer.createBot({
    host: HOST,
    port: PORT,
    username: USERNAME,
    version: false, // auto-detect
    auth: 'offline', // cracked server
    checkTimeoutInterval: 30000,
    keepAlive: true,
  });

  bot.on('login', () => {
    console.log(`✅ fxlbot دخل السيرفر بنجاح!`);
    reconnectDelay = 5000;
  });

  bot.on('spawn', () => {
    console.log(`🌍 fxlbot spawned في السيرفر`);
    
    // Anti-AFK: تحرك كل 30 ثانية
    startAntiAFK();
    
    // اكتب في الشات عند الدخول
    setTimeout(() => {
      try {
        bot.chat('/register fxlbot123 fxlbot123');
      } catch(e) {}
      setTimeout(() => {
        try {
          bot.chat('/login fxlbot123');
        } catch(e) {}
      }, 2000);
    }, 3000);
  });

  // Anti-AFK System
  let antiAFKInterval;
  
  function startAntiAFK() {
    if (antiAFKInterval) clearInterval(antiAFKInterval);
    
    antiAFKInterval = setInterval(() => {
      if (!bot || !bot.entity) return;
      
      try {
        // تحرك عشوائي بسيط
        const actions = ['forward', 'back', 'left', 'right'];
        const action = actions[Math.floor(Math.random() * actions.length)];
        
        bot.setControlState(action, true);
        setTimeout(() => {
          try { bot.setControlState(action, false); } catch(e) {}
        }, 500);
        
        // Jump أحياناً
        if (Math.random() > 0.7) {
          bot.setControlState('jump', true);
          setTimeout(() => {
            try { bot.setControlState('jump', false); } catch(e) {}
          }, 300);
        }
        
        console.log(`🔄 Anti-AFK: ${action}`);
      } catch(e) {
        console.log('Anti-AFK error:', e.message);
      }
    }, 30000); // كل 30 ثانية
  }

  bot.on('kicked', (reason) => {
    console.log(`⚠️ fxlbot تم طرده: ${reason}`);
    if (antiAFKInterval) clearInterval(antiAFKInterval);
    scheduleReconnect();
  });

  bot.on('end', (reason) => {
    console.log(`🔌 الاتصال انقطع: ${reason}`);
    if (antiAFKInterval) clearInterval(antiAFKInterval);
    scheduleReconnect();
  });

  bot.on('error', (err) => {
    console.log(`❌ خطأ: ${err.message}`);
    if (antiAFKInterval) clearInterval(antiAFKInterval);
  });

  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    console.log(`💬 ${username}: ${message}`);
  });
}

function scheduleReconnect() {
  console.log(`⏳ إعادة الاتصال خلال ${reconnectDelay/1000} ثانية...`);
  setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 1.5, 60000);
    createBot();
  }, reconnectDelay);
}

createBot();
