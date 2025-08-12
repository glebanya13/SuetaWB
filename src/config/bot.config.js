require('dotenv').config();

module.exports = {
    bot: {
        token: process.env.BOT_TOKEN,
        polling: true
    },
    channel: {
        id: process.env.CHANNEL_ID || '@suetanawb'
    },
    contact: {
        username: process.env.CONTACT_USERNAME || '@FILIPPMP'
    },
    payment: {
        info: process.env.PAYMENT_INFO || 'Перевод на карту: 1234 5678 9012 3456',
        plans: {
            month1: { period: '1 месяц', amount: 5990 },
            month6: { period: '6 месяцев', amount: 29990 }
        }
    },
    admin: {
        chatId: process.env.ADMIN_CHAT_ID
    }
};
