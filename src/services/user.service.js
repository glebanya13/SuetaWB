const Logger = require('../utils/logger');
const DatabaseService = require('../database/database');

class UserService {
    constructor() {
        this.db = new DatabaseService();
        this.userStates = new Map();
        this.paymentInfo = new Map();
    }

    addUser(chatId, userInfo) {
        const numericChatId = Number(chatId);
        try {
            this.db.addUser(numericChatId, userInfo);
            Logger.userAction('добавлен в систему', numericChatId, userInfo.username);
        } catch (error) {
            Logger.error('Ошибка при добавлении пользователя в БД', { chatId: numericChatId, error: error.message });
        }
    }

    getAllUsers() {
        try {
            const users = this.db.getAllUsers();
            Logger.info('🔍 getAllUsers вызван', {
                users: users,
                length: users.length,
                type: typeof users,
                isArray: Array.isArray(users)
            });
            return users;
        } catch (error) {
            Logger.error('Ошибка при получении пользователей из БД', { error: error.message });
            return [];
        }
    }

    getUserCount() {
        try {
            return this.db.getUserCount();
        } catch (error) {
            Logger.error('Ошибка при получении количества пользователей', { error: error.message });
            return 0;
        }
    }

    setState(chatId, state) {
        try {
            this.db.setUserState(chatId, state);
            this.userStates.set(chatId, state);
            Logger.debug('Состояние пользователя изменено', { chatId, state });
        } catch (error) {
            Logger.error('Ошибка при установке состояния в БД', { chatId, state, error: error.message });
            this.userStates.set(chatId, state);
        }
    }

    getState(chatId) {
        try {
            const dbState = this.db.getUserState(chatId);
            if (dbState) {
                this.userStates.set(chatId, dbState.state);
                return dbState.state;
            }
        } catch (error) {
            Logger.error('Ошибка при получении состояния из БД', { chatId, error: error.message });
        }
        return this.userStates.get(chatId);
    }

    setPaymentInfo(chatId, period, amount) {
        try {
            this.db.setUserState(chatId, 'waiting_payment_screenshot', { period, amount });
            this.paymentInfo.set(chatId, { period, amount });
            Logger.debug('Информация о платеже установлена', { chatId, period, amount });
        } catch (error) {
            Logger.error('Ошибка при установке платежа в БД', { chatId, period, amount, error: error.message });
            this.paymentInfo.set(chatId, { period, amount });
        }
    }

    getPaymentInfo(chatId) {
        try {
            const dbState = this.db.getUserState(chatId);
            if (dbState && dbState.payment_period && dbState.payment_amount) {
                return { period: dbState.payment_period, amount: dbState.payment_amount };
            }
        } catch (error) {
            Logger.error('Ошибка при получении платежа из БД', { chatId, error: error.message });
        }
        return this.paymentInfo.get(chatId);
    }

    resetToMainMenu(chatId) {
        try {
            this.db.resetUserToMainMenu(chatId);
            this.userStates.set(chatId, 'main_menu');
            this.paymentInfo.delete(chatId);
            Logger.debug('Пользователь возвращен в главное меню', { chatId });
        } catch (error) {
            Logger.error('Ошибка при сбросе пользователя в БД', { chatId, error: error.message });
            this.userStates.set(chatId, 'main_menu');
            this.paymentInfo.delete(chatId);
        }
    }

    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = UserService;
