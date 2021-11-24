process.env.NTBA_FIX_319 = 1

const TelegramBot = require('node-telegram-bot-api')

/** production **/
const token = "YOUR_TELEGRAM_BOT_TOKEN";
const chatId = "USER_CHAT_ID";

const bot = new TelegramBot(token, { polling: false });

function sendMessage(message) {
    try {
        bot.sendMessage(chatId, message, {
            parse_mode: 'html',
            disable_web_page_preview: true
        });
    } catch (err) {
        console.log('Something went wrong when trying to send a Telegram notification', err);
    }
}

module.exports = sendMessage;