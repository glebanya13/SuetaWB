const { mainKeyboard, paymentKeyboard } = require('../config/keyboards');
const config = require('../config/bot.config');
const Logger = require('../utils/logger');

class CommandHandler {
    constructor(bot, userService) {
        this.bot = bot;
        this.userService = userService;
    }

    handleStart(msg) {
        const chatId = msg.chat.id;

        this.userService.addUser(chatId, {
            username: msg.from.username,
            first_name: msg.from.first_name,
            last_name: msg.from.last_name
        });

        const welcomeMessage = `Привет! Я — Филипп, автор канала ${config.channel.id}.

Дам готовые решения по товарам, идеям для продажи на маркетплейсах. А также поделюсь контактами производств в РФ и СНГ. Также можем провести аудит и прокачать ваши продажи.

Выбери интересующий тебя раздел:`;

        this.userService.resetToMainMenu(chatId);
        this.bot.sendMessage(chatId, welcomeMessage, mainKeyboard);

        Logger.userAction('начал работу с ботом', chatId, msg.from.username);
    }

    handleMainMenu(chatId, text) {
        if (config.admin.chatId && chatId.toString() === config.admin.chatId.toString()) {
            Logger.warn('Попытка админа использовать пользовательское меню', { chatId, text });
            return;
        }

        switch (text) {
            case '📺 Доступ к закрытому каналу':
                const channelInfo = `В канале вы получите ежемесячную аналитику 10 товаров из разных категорий для продажи в ближайший сезон + эфиры с разбором и продвижением этих товаров.

Выберите период подписки:`;
                this.bot.sendMessage(chatId, channelInfo, paymentKeyboard);
                break;

            case '🏭 Найти производство в РФ/СНГ':
                const productionInfo = `Проверенные производства РФ и СНГ, работающие под ключ.

Напишите мне и обсудим ваш запрос ${config.contact.username}`;
                this.bot.sendMessage(chatId, productionInfo, mainKeyboard);
                break;

            case '📦 Заказать услугу "Подбор товара"':
                const productSelectionInfo = `Вы получите готовый документ и юнит экономику по лучшим направлениям товаров для продажи на маркетплейсах.

Напишите мне и обсудим ваш запрос ${config.contact.username}`;
                this.bot.sendMessage(chatId, productSelectionInfo, mainKeyboard);
                break;

            case '🔍 Аудит кабинета':
                const auditInfo = `Разбор ваших кабинетов на Wildberries и Ozon для увеличения ваших продаж и оптимизации ваших бизнес процессов.

Напишите мне и обсудим ваш запрос ${config.contact.username}`;
                this.bot.sendMessage(chatId, auditInfo, mainKeyboard);
                break;

            default:
                break;
        }
    }

    handlePayment(chatId, period, amount) {
        if (config.admin.chatId && chatId.toString() === config.admin.chatId.toString()) {
            Logger.warn('Попытка админа использовать пользовательское меню оплаты', { chatId, period, amount });
            return;
        }

        const paymentMessage = `Оплата за ${period} - ${amount}₽

${config.payment.info}

После оплаты пришлите скриншот чека для подтверждения.`;

        this.userService.setPaymentInfo(chatId, period, amount);
        this.userService.setState(chatId, 'waiting_payment_screenshot');

        this.bot.sendMessage(chatId, paymentMessage, {
            reply_markup: {
                keyboard: [['🔙 Назад к меню']],
                resize_keyboard: true,
                one_time_keyboard: false
            }
        });

        Logger.paymentEvent('выбрал период оплаты', chatId, amount, period);
    }

    handlePaymentScreenshot(chatId, msg) {
        if (config.admin.chatId && chatId.toString() === config.admin.chatId.toString()) {
            Logger.warn('Попытка админа использовать пользовательское меню скриншота', { chatId });
            return;
        }

        if (msg.text === '🔙 Назад к меню') {
            this.userService.resetToMainMenu(chatId);
            this.showMainMenu(chatId);
            return;
        }

        if (msg.photo) {
            const photo = msg.photo[msg.photo.length - 1];
            const paymentInfo = this.userService.getPaymentInfo(chatId);

            if (!paymentInfo || !paymentInfo.period || !paymentInfo.amount) {
                Logger.error('Информация о платеже не найдена', { chatId, paymentInfo });
                this.bot.sendMessage(chatId, '❌ Ошибка: информация о платеже не найдена. Попробуйте выбрать период оплаты заново.');
                this.userService.resetToMainMenu(chatId);
                this.showMainMenu(chatId);
                return null;
            }

            this.bot.sendMessage(chatId, `✅ Скриншот оплаты получен! 

Ожидайте подтверждения. После проверки вы получите ссылку на закрытый канал ${config.channel.id}.

Обычно это занимает 5-15 минут.`, mainKeyboard);

            this.userService.resetToMainMenu(chatId);

            return {
                username: msg.from.username || msg.from.first_name,
                period: paymentInfo.period,
                amount: paymentInfo.amount,
                photoFileId: photo.file_id
            };
        } else {
            this.bot.sendMessage(chatId, 'Пожалуйста, пришлите скриншот оплаты или нажмите "Назад к меню"');
            return null;
        }
    }

    showMainMenu(chatId) {
        const welcomeMessage = `Выбери интересующий тебя раздел:`;
        this.bot.sendMessage(chatId, welcomeMessage, mainKeyboard);
    }
}

module.exports = CommandHandler;
