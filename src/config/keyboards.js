// Клавиатуры для клиентов
const mainKeyboard = {
    reply_markup: {
        keyboard: [
            ['📺 Доступ к закрытому каналу'],
            ['🏭 Найти производство в РФ/СНГ'],
            ['📦 Заказать услугу "Подбор товара"'],
            ['🔍 Аудит кабинета']
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    }
};

const paymentKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: '💳 Оплатить 1 месяц (5990₽)', callback_data: 'pay_1month' }],
            [{ text: '💳 Оплатить 6 месяцев (29990₽)', callback_data: 'pay_6months' }],
            [{ text: '🔙 Назад', callback_data: 'back_to_main' }]
        ]
    }
};

// Клавиатуры для админа
const adminMainKeyboard = {
    reply_markup: {
        keyboard: [
            ['📊 Статистика'],
            ['💰 Управление платежами'],
            ['📢 Рассылка сообщений']
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    }
};

const adminInlineKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: '📊 Статистика', callback_data: 'admin_stats' }],
            [{ text: '💰 Платежи', callback_data: 'admin_payments' }],
            [{ text: '📢 Отправить сообщение', callback_data: 'admin_broadcast' }]
        ]
    }
};

module.exports = {
    // Клиентские клавиатуры
    mainKeyboard,
    paymentKeyboard,
    
    // Админские клавиатуры
    adminMainKeyboard,
    adminInlineKeyboard
};
