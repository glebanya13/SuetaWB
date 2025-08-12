const Database = require('better-sqlite3');
const path = require('path');
const Logger = require('../utils/logger');

class DatabaseService {
    constructor() {
        const dbPath = path.join(__dirname, '../../data/suetawb_bot.db');
        
        const fs = require('fs');
        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        
        this.db = new Database(dbPath);
        this.initDatabase();
        
        const cleanedCount = this.cleanInvalidPhotoFileIds();
        if (cleanedCount > 0) {
            Logger.info(`Очищено ${cleanedCount} некорректных photo_file_id при инициализации`);
        }
        
        Logger.info('База данных инициализирована', { path: dbPath });
    }

    initDatabase() {
        this.db.pragma('foreign_keys = ON');

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                chat_id INTEGER PRIMARY KEY,
                username TEXT,
                first_name TEXT,
                last_name TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_chat_id INTEGER NOT NULL,
                period TEXT NOT NULL,
                amount INTEGER NOT NULL,
                photo_file_id TEXT,
                status TEXT DEFAULT 'pending',
                reason TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_chat_id) REFERENCES users(chat_id) ON DELETE CASCADE
            )
        `);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS user_states (
                chat_id INTEGER PRIMARY KEY,
                state TEXT NOT NULL,
                payment_period TEXT,
                payment_amount INTEGER,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (chat_id) REFERENCES users(chat_id) ON DELETE CASCADE
            )
        `);

        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
            CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_chat_id);
        `);

        Logger.info('Структура базы данных создана');
    }

    // Методы для работы с пользователями
    addUser(chatId, userData = {}) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO users (chat_id, username, first_name, last_name, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        
        const result = stmt.run(
            chatId,
            userData.username || null,
            userData.first_name || null,
            userData.last_name || null
        );
        
        Logger.debug('Пользователь добавлен/обновлен в БД', { chatId, result: result.changes });
        
        if (result.changes > 0) {
            Logger.info('👤 Новый пользователь добавлен в БД:', {
                chat_id: chatId,
                username: userData.username || 'без username',
                first_name: userData.first_name || 'без имени',
                last_name: userData.last_name || 'без фамилии',
                timestamp: new Date().toISOString()
            });
        }
        
        return result.changes > 0;
    }

    getUser(chatId) {
        const stmt = this.db.prepare('SELECT * FROM users WHERE chat_id = ?');
        const user = stmt.get(chatId);
        
        if (user) {
            Logger.debug('🔍 Информация о пользователе запрошена:', {
                chat_id: user.chat_id,
                username: user.username || 'без username',
                first_name: user.first_name || 'без имени',
                last_name: user.last_name || 'без фамилии',
                is_active: user.is_active,
                created_at: user.created_at,
                updated_at: user.updated_at
            });
        } else {
            Logger.debug('❓ Пользователь не найден в БД:', { chat_id: chatId });
        }
        
        return user;
    }

    getAllUsers() {
        const stmt = this.db.prepare(`
            SELECT DISTINCT u.chat_id, u.username, u.first_name, u.last_name, u.created_at, u.updated_at
            FROM users u 
            ORDER BY u.updated_at DESC
        `);
        
        const users = stmt.all();
        const uniqueUsers = new Set(users.map(u => u.chat_id));
        
        Logger.debug('Получены все пользователи из БД', { 
            rawCount: users.length, 
            uniqueCount: uniqueUsers.size,
            users: Array.from(uniqueUsers)
        });
        
        if (users.length > 0) {
            Logger.info('📋 Список всех пользователей в БД:', {
                total: users.length,
                users: users.map(u => ({
                    chat_id: u.chat_id,
                    username: u.username || 'без username',
                    first_name: u.first_name || 'без имени',
                    last_name: u.last_name || 'без фамилии',
                    created_at: u.created_at,
                    updated_at: u.updated_at
                }))
            });
        } else {
            Logger.warn('⚠️ В БД нет пользователей для рассылки');
        }
        
        return uniqueUsers;
    }

    getUserCount() {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM users');
        const count = stmt.get().count;
        
        Logger.debug('📊 Количество пользователей в БД:', { 
            totalUsers: count,
            timestamp: new Date().toISOString()
        });
        
        return count;
    }

    addPayment(userChatId, paymentInfo) {
        Logger.info('Попытка добавить платеж в БД', { userChatId, paymentInfo });
        
        const stmt = this.db.prepare(`
            INSERT INTO payments (user_chat_id, period, amount, photo_file_id, status)
            VALUES (?, ?, ?, ?, 'pending')
        `);
        
        const result = stmt.run(
            userChatId,
            paymentInfo.period,
            paymentInfo.amount,
            paymentInfo.photoFileId || null
        );
        
        Logger.debug('Платеж добавлен в БД', { userChatId, paymentId: result.lastInsertRowid });
        
        Logger.info('💰 Новый платеж добавлен в БД:', {
            payment_id: result.lastInsertRowid,
            user_chat_id: userChatId,
            period: paymentInfo.period,
            amount: paymentInfo.amount,
            photo_file_id: paymentInfo.photoFileId || 'не указан',
            status: 'pending',
            timestamp: new Date().toISOString()
        });
        
        return result.lastInsertRowid;
    }

    getPendingPayments() {
        Logger.info('Запрашиваем ожидающие платежи из БД');
        
        const stmt = this.db.prepare(`
            SELECT * FROM payments WHERE status = 'pending' ORDER BY created_at ASC
        `);
        
        const payments = stmt.all();
        
        Logger.info('📋 Ожидающие платежи запрошены из БД:', {
            total_payments: payments.length,
            payments: payments.map(p => ({
                payment_id: p.id,
                user_chat_id: p.user_chat_id,
                username: 'пользователь',
                first_name: 'пользователь',
                last_name: 'пользователь',
                period: p.period,
                amount: p.amount,
                photo_file_id: p.photo_file_id || 'не указан',
                created_at: p.created_at
            }))
        });
        
        return payments;
    }

    getAllPayments() {
        Logger.info('Запрашиваем ВСЕ платежи из БД');
        
        const stmt = this.db.prepare(`
            SELECT * FROM payments ORDER BY created_at DESC
        `);
        
        const allPayments = stmt.all();
        
        Logger.info('📋 Все платежи в БД:', {
            total_payments: allPayments.length,
            payments: allPayments.map(p => ({
                payment_id: p.id,
                user_chat_id: p.user_chat_id,
                period: p.period,
                amount: p.amount,
                photo_file_id: p.photo_file_id || 'не указан',
                status: p.status,
                created_at: p.created_at
            }))
        });
        
        return allPayments;
    }

    updatePaymentStatus(paymentId, status, reason = null) {
        const stmt = this.db.prepare(`
            UPDATE payments 
            SET status = ?, reason = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        
        const result = stmt.run(status, reason, paymentId);
        Logger.debug('Статус платежа обновлен', { paymentId, status, changes: result.changes });
        return result.changes > 0;
    }

    deletePayment(paymentId) {
        const stmt = this.db.prepare('DELETE FROM payments WHERE id = ?');
        const result = stmt.run(paymentId);
        Logger.debug('Платеж удален из БД', { paymentId, changes: result.changes });
        return result.changes > 0;
    }

    // Методы для работы с состояниями пользователей
    setUserState(chatId, state, paymentInfo = null) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO user_states (chat_id, state, payment_period, payment_amount, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        
        const result = stmt.run(
            chatId,
            state,
            paymentInfo?.period || null,
            paymentInfo?.amount || null
        );
        
        Logger.debug('Состояние пользователя обновлено', { chatId, state, changes: result.changes });
        
        // Логируем изменение состояния пользователя
        if (result.changes > 0) {
            Logger.info('🔄 Состояние пользователя обновлено в БД:', {
                chat_id: chatId,
                state: state,
                payment_period: paymentInfo?.period || 'не указан',
                payment_amount: paymentInfo?.amount || 'не указана',
                timestamp: new Date().toISOString()
            });
        }
        
        return result.changes > 0;
    }

    getUserState(chatId) {
        const stmt = this.db.prepare('SELECT * FROM user_states WHERE chat_id = ?');
        const userState = stmt.get(chatId);
        
        // Логируем запрос состояния пользователя
        if (userState) {
            Logger.debug('🔍 Состояние пользователя запрошено:', {
                chat_id: userState.chat_id,
                state: userState.state,
                payment_period: userState.payment_period || 'не указан',
                payment_amount: userState.payment_amount || 'не указана',
                updated_at: userState.updated_at
            });
        } else {
            Logger.debug('❓ Состояние пользователя не найдено в БД:', { chat_id: chatId });
        }
        
        return userState;
    }

    resetUserToMainMenu(chatId) {
        return this.setUserState(chatId, 'main_menu');
    }

    // Методы для статистики
    getStats() {
        const stats = {};
        
        // Общее количество пользователей
        const userCountStmt = this.db.prepare('SELECT COUNT(*) as count FROM users');
        stats.totalUsers = userCountStmt.get().count;
        
        // Общее количество всех платежей (всех статусов)
        const allPaymentsStmt = this.db.prepare('SELECT COUNT(*) as count FROM payments');
        stats.totalPayments = allPaymentsStmt.get().count;
        
        // Количество ожидающих платежей
        const pendingPaymentsStmt = this.db.prepare('SELECT COUNT(*) as count FROM payments WHERE status = ?');
        stats.pendingPayments = pendingPaymentsStmt.get('pending').count;
        
        // Количество подтвержденных платежей
        const confirmedPaymentsStmt = this.db.prepare('SELECT COUNT(*) as count FROM payments WHERE status = ?');
        stats.confirmedPayments = confirmedPaymentsStmt.get('confirmed').count;
        
        // Количество отклоненных платежей
        const rejectedPaymentsStmt = this.db.prepare('SELECT COUNT(*) as count FROM payments WHERE status = ?');
        stats.rejectedPayments = rejectedPaymentsStmt.get('rejected').count;
        
        // Общая сумма всех платежей
        const totalAmountStmt = this.db.prepare('SELECT SUM(amount) as total FROM payments');
        stats.totalAmount = totalAmountStmt.get().total || 0;
        
        // Общая сумма подтвержденных платежей
        const confirmedAmountStmt = this.db.prepare('SELECT SUM(amount) as total FROM payments WHERE status = ?');
        stats.confirmedAmount = confirmedAmountStmt.get('confirmed').total || 0;
        
        // Логируем статистику пользователей
        Logger.info('📊 Статистика пользователей в БД:', {
            totalUsers: stats.totalUsers,
            totalPayments: stats.totalPayments,
            pendingPayments: stats.pendingPayments,
            confirmedPayments: stats.confirmedPayments,
            rejectedPayments: stats.rejectedPayments,
            totalAmount: stats.totalAmount,
            confirmedAmount: stats.confirmedAmount
        });
        
        return stats;
    }

    // Методы для миграции данных (если нужно)
    migrateFromMemory(userStates, allUsers, pendingPayments) {
        Logger.info('Начинаем миграцию данных из памяти в БД');
        
        // Мигрируем пользователей
        for (const chatId of allUsers) {
            this.addUser(chatId);
        }
        
        // Мигрируем состояния
        for (const [chatId, state] of userStates) {
            this.setUserState(chatId, state);
        }
        
        // Мигрируем платежи (если есть)
        for (const [chatId, paymentInfo] of pendingPayments) {
            this.addPayment(chatId, paymentInfo);
        }
        
        Logger.info('Миграция данных завершена');
    }

    // Безопасное удаление пользователя
    deleteUser(chatId) {
        try {
            // Начинаем транзакцию
            this.db.exec('BEGIN TRANSACTION');
            
            // Удаляем в правильном порядке (сначала зависимые таблицы)
            const deleteStatesStmt = this.db.prepare('DELETE FROM user_states WHERE chat_id = ?');
            const deletePaymentsStmt = this.db.prepare('DELETE FROM payments WHERE user_chat_id = ?');
            const deleteUserStmt = this.db.prepare('DELETE FROM users WHERE chat_id = ?');
            
            // Удаляем состояния
            const statesResult = deleteStatesStmt.run(chatId);
            Logger.debug('Удалены состояния пользователя', { chatId, deletedStates: statesResult.changes });
            
            // Удаляем платежи
            const paymentsResult = deletePaymentsStmt.run(chatId);
            Logger.debug('Удалены платежи пользователя', { chatId, deletedPayments: paymentsResult.changes });
            
            // Удаляем пользователя
            const userResult = deleteUserStmt.run(chatId);
            Logger.debug('Удален пользователь', { chatId, deletedUser: userResult.changes });
            
            // Подтверждаем транзакцию
            this.db.exec('COMMIT');
            
            Logger.info('Пользователь безопасно удален из БД', { 
                chatId, 
                deletedStates: statesResult.changes,
                deletedPayments: paymentsResult.changes,
                deletedUser: userResult.changes
            });
            
            return true;
            
        } catch (error) {
            // Откатываем транзакцию при ошибке
            this.db.exec('ROLLBACK');
            Logger.error('Ошибка при удалении пользователя', { chatId, error: error.message });
            return false;
        }
    }

    // Очистка всех данных (для тестирования)
    clearAllData() {
        try {
            Logger.warn('Начинаем полную очистку базы данных');
            
            // Отключаем внешние ключи временно
            this.db.pragma('foreign_keys = OFF');
            
            // Очищаем все таблицы
            this.db.exec(`
                DELETE FROM user_states;
                DELETE FROM payments;
                DELETE FROM users;
            `);
            
            // Включаем внешние ключи обратно
            this.db.pragma('foreign_keys = ON');
            
            Logger.info('База данных полностью очищена');
            return true;
            
        } catch (error) {
            Logger.error('Ошибка при очистке базы данных', error);
            return false;
        }
    }

    // Очистка некорректных photo_file_id
    cleanInvalidPhotoFileIds() {
        try {
            Logger.warn('Начинаем очистку некорректных photo_file_id');
            
            // Находим и обновляем некорректные photo_file_id
            const updateStmt = this.db.prepare(`
                UPDATE payments 
                SET photo_file_id = NULL 
                WHERE photo_file_id = 'test_photo_stats' 
                OR photo_file_id = '' 
                OR photo_file_id IS NULL
                OR photo_file_id NOT LIKE '%_%'
            `);
            
            const result = updateStmt.run();
            
            Logger.info('Некорректные photo_file_id очищены', {
                updatedRows: result.changes,
                timestamp: new Date().toISOString()
            });
            
            return result.changes;
            
        } catch (error) {
            Logger.error('Ошибка при очистке некорректных photo_file_id', error);
            return 0;
        }
    }

    // Закрытие соединения
    close() {
        if (this.db) {
            this.db.close();
            Logger.info('Соединение с базой данных закрыто');
        }
    }
}

module.exports = DatabaseService;
