const Logger = require('../utils/logger');

class UserService {
    constructor() {
        this.allUsers = [];
        this.userStates = new Map();
        this.paymentInfo = new Map();
        

    }

    addUser(chatId, userInfo) {
        const numericChatId = Number(chatId);
        if (!this.allUsers.includes(numericChatId)) {
            this.allUsers.push(numericChatId);
            Logger.userAction('добавлен в систему', numericChatId, userInfo.username);
        } else {
            Logger.debug('пользователь уже существует', { numericChatId, username: userInfo.username });
        }
    }

    getAllUsers() {
        Logger.info('🔍 getAllUsers вызван', { 
            allUsers: this.allUsers, 
            length: this.allUsers.length,
            type: typeof this.allUsers,
            isArray: Array.isArray(this.allUsers)
        });
        return this.allUsers;
    }

    getUserCount() {
        return this.allUsers.size;
    }

    setState(chatId, state) {
        this.userStates.set(chatId, state);
        Logger.debug('Состояние пользователя изменено', { chatId, state });
    }

    getState(chatId) {
        return this.userStates.get(chatId);
    }

    setPaymentInfo(chatId, period, amount) {
        this.paymentInfo.set(chatId, { period, amount });
        Logger.debug('Информация о платеже установлена', { chatId, period, amount });
    }

    getPaymentInfo(chatId) {
        return this.paymentInfo.get(chatId);
    }

    resetToMainMenu(chatId) {
        this.userStates.set(chatId, 'main_menu');
        this.paymentInfo.delete(chatId);
        Logger.debug('Пользователь возвращен в главное меню', { chatId });
    }
}

module.exports = UserService;
