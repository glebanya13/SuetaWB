const { mainKeyboard } = require('../config/keyboards');
const config = require('../config/bot.config');
const Logger = require('../utils/logger');

class CallbackHandler {
    constructor(bot, userService, commandHandler) {
        this.bot = bot;
        this.userService = userService;
        this.commandHandler = commandHandler;
    }

    handleCallback(query) {
        const chatId = query.message.chat.id;
        const data = query.data;

        if (config.admin.chatId && chatId.toString() === config.admin.chatId.toString()) {
            Logger.warn('Попытка админа использовать пользовательские callback\'и', { chatId, data });
            return false;
        }

        let isUserCallbackHandled = false;
        
        switch (data) {
            case 'pay_1month':
                this.commandHandler.handlePayment(chatId, config.payment.plans.month1.period, config.payment.plans.month1.amount);
                isUserCallbackHandled = true;
                break;
                
            case 'pay_6months':
                this.commandHandler.handlePayment(chatId, config.payment.plans.month6.period, config.payment.plans.month6.amount);
                isUserCallbackHandled = true;
                break;
                
            case 'back_to_main':
                this.userService.resetToMainMenu(chatId);
                this.commandHandler.showMainMenu(chatId);
                isUserCallbackHandled = true;
                break;
                
            default:
                break;
        }

        if (!isUserCallbackHandled && (!config.admin.chatId || chatId.toString() !== config.admin.chatId.toString())) {
            Logger.debug('Неизвестный пользовательский callback', { data, chatId });
        }

        this.bot.answerCallbackQuery(query.id);
        
        return isUserCallbackHandled;
    }
}

module.exports = CallbackHandler;
