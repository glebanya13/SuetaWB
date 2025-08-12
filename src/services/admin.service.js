const Logger = require('../utils/logger');

class AdminService {
    constructor(bot, userService, adminChatId) {
        this.bot = bot;
        this.userService = userService;
        this.adminChatId = adminChatId;
        this.pendingPayments = new Map();
        this.completedPayments = new Map();
        this.waitingForBroadcast = false;
    }

    setupAdminCommands() {
        Logger.info('Команды админа настроены');
    }

    showAdminMenu(chatId) {
        const message = `🔧 Панель администратора Philipp

Добро пожаловать в админ-панель! Здесь вы можете:

📊 Просматривать статистику бота
💰 Управление платежами
📢 Рассылка сообщений
⚙️ Настройки

Выберите нужный раздел:`;

        this.bot.sendMessage(chatId, message, {
            reply_markup: {
                keyboard: [
                    ['📊 Статистика'],
                    ['💰 Управление платежами'],
                    ['📢 Рассылка сообщений'],
                    ['⚙️ Настройки']
                ],
                resize_keyboard: true,
                one_time_keyboard: false
            }
        });
    }

    handleAdminButton(chatId, text) {
        switch (text) {
            case '📊 Статистика':
                this.showStats(chatId);
                break;
            case '💰 Управление платежами':
                this.showPendingPayments(chatId);
                break;
            case '📢 Рассылка сообщений':
                const userCount = this.userService.getAllUsers().size;
                if (userCount === 0) {
                    this.bot.sendMessage(chatId, '❌ Нет пользователей для рассылки. Сначала должны появиться пользователи.');
                } else {
                    this.startBroadcast(chatId);
                }
                break;
            case '⚙️ Настройки':
                this.showSettings(chatId);
                break;
            default:
                Logger.warn('Неизвестная админская кнопка', { chatId, text });
                break;
        }
    }

    showStats(chatId) {
        const allUsers = this.userService.getAllUsers();
        const stats = {
            totalUsers: allUsers && allUsers.length ? allUsers.length : 0,
            totalPayments: this.pendingPayments.size,
            botUptime: this.getUptime()
        };

        const message = `📊 Статистика бота:

👥 Всего пользователей: ${stats.totalUsers}
💰 Ожидающих платежей: ${stats.totalPayments}
⏱️ Время работы: ${stats.botUptime}`;

        this.bot.sendMessage(chatId, message);
    }

    showPendingPayments(chatId) {
        let totalPending = this.pendingPayments.size;
        let totalCompleted = this.completedPayments.size;
        
        if (totalPending === 0 && totalCompleted === 0) {
            this.bot.sendMessage(chatId, '✅ Нет платежей');
            return;
        }

        if (totalPending > 0) {
            this.bot.sendMessage(chatId, `📋 ОЖИДАЮЩИЕ ПЛАТЕЖИ (${totalPending}):`);
            
            let counter = 1;
            for (const [userChatId, paymentInfo] of this.pendingPayments) {
                const message = `💰 Платеж ${counter}:

👤 Пользователь: ${paymentInfo.username || 'без username'}
📅 Период: ${paymentInfo.period}
💰 Сумма: ${paymentInfo.amount}₽
⏰ Время: ${paymentInfo.timestamp}`;

                const keyboard = {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '✅ Подтвердить', callback_data: `confirm_direct_${userChatId}` },
                                { text: '❌ Отклонить', callback_data: `reject_direct_${userChatId}` }
                            ]
                        ]
                    }
                };

                if (paymentInfo.photoFileId) {
                    try {
                        this.bot.sendPhoto(chatId, paymentInfo.photoFileId, {
                            caption: message,
                            reply_markup: keyboard.reply_markup
                        });
                    } catch (error) {
                        this.bot.sendMessage(chatId, message + '\n\n⚠️ Не удалось загрузить скриншот', keyboard);
                    }
                } else {
                    this.bot.sendMessage(chatId, message + '\n\n📸 Скриншот отсутствует', keyboard);
                }

                counter++;
            }
        }

        if (totalCompleted > 0) {
            this.bot.sendMessage(chatId, `\n📋 ЗАВЕРШЕННЫЕ ПЛАТЕЖИ (${totalCompleted}):`);
            
            let counter = 1;
            for (const [userChatId, paymentInfo] of this.completedPayments) {
                const statusEmoji = paymentInfo.status === 'confirmed' ? '✅' : '❌';
                const statusText = paymentInfo.status === 'confirmed' ? 'Подтвержден' : 'Отклонен';
                
                const message = `${statusEmoji} Платеж ${counter}:

👤 Пользователь: ${paymentInfo.username || 'без username'}
📅 Период: ${paymentInfo.period}
💰 Сумма: ${paymentInfo.amount}₽
📊 Статус: ${statusText}
⏰ Завершен: ${paymentInfo.completedAt}`;

                this.bot.sendMessage(chatId, message);
                counter++;
            }
        }

        const summaryMessage = `📊 ИТОГО:
⏳ Ожидающих: ${totalPending}
✅ Подтвержденных: ${Array.from(this.completedPayments.values()).filter(p => p.status === 'confirmed').length}
❌ Отклоненных: ${Array.from(this.completedPayments.values()).filter(p => p.status === 'rejected').length}`;

        this.bot.sendMessage(chatId, summaryMessage);
    }

    addPendingPayment(userChatId, paymentInfo) {
        const paymentData = {
            period: paymentInfo.period,
            amount: paymentInfo.amount,
            photoFileId: paymentInfo.photoFileId,
            username: paymentInfo.username,
            first_name: paymentInfo.username || 'без имени',
            last_name: 'без фамилии'
        };
        
        const paymentId = Date.now();
        
        const numericKey = Number(userChatId);
        this.pendingPayments.set(numericKey, {
            ...paymentData,
            id: paymentId,
            timestamp: new Date().toLocaleString('ru-RU')
        });

        this.userService.addUser(userChatId, {
            username: paymentInfo.username,
            first_name: paymentInfo.username || 'без имени',
            last_name: 'без фамилии'
        });
        
        Logger.paymentEvent('новый платеж добавлен', userChatId, paymentInfo.amount, paymentInfo.period);
        this.notifyAdmin(userChatId, paymentData);
    }

    confirmPayment(userChatId, reason = 'Подтвержден администратором') {
        let paymentInfo = this.pendingPayments.get(userChatId);
        if (!paymentInfo) {
            const numericKey = Number(userChatId);
            paymentInfo = this.pendingPayments.get(numericKey);
        }
        if (!paymentInfo) {
            const stringKey = userChatId.toString();
            paymentInfo = this.pendingPayments.get(stringKey);
        }
        
        if (!paymentInfo) {
            return false;
        }

        const channelLink = `https://t.me/${process.env.CHANNEL_ID?.replace('@', '')}`;
        const message = `✅ Платеж подтвержден!

Добро пожаловать в закрытый канал ${process.env.CHANNEL_ID}!

Ссылка: ${channelLink}

Спасибо за доверие! 🚀`;

        this.bot.sendMessage(userChatId, message);
        
        this.pendingPayments.delete(userChatId);
        this.pendingPayments.delete(Number(userChatId));
        this.pendingPayments.delete(userChatId.toString());
        
        const completedPayment = {
            ...paymentInfo,
            status: 'confirmed',
            reason: reason,
            completedAt: new Date().toLocaleString('ru-RU')
        };
        
        this.completedPayments.set(userChatId, completedPayment);
        
        this.userService.addUser(userChatId, {
            username: paymentInfo.username,
            first_name: paymentInfo.username || 'без имени',
            last_name: 'без фамилии'
        });
        
        this.bot.sendMessage(this.adminChatId, `✅ Платеж пользователя ${paymentInfo.username} подтвержден!`);

        Logger.paymentEvent('платеж подтвержден', userChatId, paymentInfo.amount, paymentInfo.period);
        Logger.adminAction(`подтвердил платеж пользователя ${paymentInfo.username}`, this.adminChatId);

        return true;
    }

    rejectPayment(userChatId, reason = 'Платеж не найден') {
        let paymentInfo = this.pendingPayments.get(userChatId);
        if (!paymentInfo) {
            const numericKey = Number(userChatId);
            paymentInfo = this.pendingPayments.get(numericKey);
        }
        if (!paymentInfo) {
            const stringKey = userChatId.toString();
            paymentInfo = this.pendingPayments.get(stringKey);
        }
        
        if (!paymentInfo) {
            return false;
        }

        const message = `❌ Платеж отклонен

Причина: ${reason}

Если у вас есть вопросы, обратитесь к администратору.`;

        this.bot.sendMessage(userChatId, message);
        
        this.pendingPayments.delete(userChatId);
        this.pendingPayments.delete(Number(userChatId));
        this.pendingPayments.delete(userChatId.toString());
        
        const completedPayment = {
            ...paymentInfo,
            status: 'rejected',
            reason: reason,
            completedAt: new Date().toLocaleString('ru-RU')
        };
        
        this.completedPayments.set(userChatId, completedPayment);
        
        this.bot.sendMessage(this.adminChatId, `❌ Платеж пользователя ${paymentInfo.username} отклонен!`);

        Logger.paymentEvent('платеж отклонен', userChatId, paymentInfo.amount, paymentInfo.period);
        Logger.adminAction(`отклонил платеж пользователя ${paymentInfo.username}`, this.adminChatId);

        return true;
    }

    handleAdminCallback(query) {
        const data = query.data;
        const chatId = query.message.chat.id;

        if (data.startsWith('confirm_direct_')) {
            const userChatId = data.replace('confirm_direct_', '');
            const result = this.confirmPayment(userChatId, 'Подтвержден администратором');
            if (result) {
                this.editMessageToRemoveButtons(query.message, '✅ Платеж подтвержден!');
            }
        } else if (data.startsWith('reject_direct_')) {
            const userChatId = data.replace('reject_direct_', '');
            const result = this.rejectPayment(userChatId, 'Отклонен администратором');
            if (result) {
                this.editMessageToRemoveButtons(query.message, '❌ Платеж отклонен!');
            }
        } else {
            Logger.warn('Неизвестный админский callback', { data, chatId });
        }
    }



    startBroadcast(chatId) {
        this.waitingForBroadcast = true;
        this.bot.sendMessage(chatId, '📢 Введите текст сообщения для рассылки всем пользователям:');
    }

    async sendBroadcast(message, adminChatId) {
        this.waitingForBroadcast = false;
        
        const allUsers = this.userService.getAllUsers();
        
        Logger.info('🔍 Начинаем рассылку', { 
            totalUsers: allUsers ? allUsers.length : 0, 
            users: allUsers ? allUsers : [] 
        });
        
        if (!allUsers || allUsers.length === 0) {
            this.bot.sendMessage(adminChatId, '❌ Нет пользователей для рассылки');
            return;
        }

        this.bot.sendMessage(adminChatId, `📤 Начинаем рассылку сообщения ${allUsers.length} пользователям...`);

        let successCount = 0;
        let failCount = 0;
        let blockedCount = 0;
        const sentUsers = new Set();

        Logger.info('🔍 Пользователи для рассылки', { 
            totalUsers: allUsers.length, 
            users: allUsers,
            uniqueUsers: [...new Set(allUsers)]
        });
        
        const uniqueUsers = [...new Set(allUsers)];
        Logger.info('🔍 Уникальные пользователи', { uniqueUsers });
        
        for (const userId of uniqueUsers) {
                    // Пропускаем админа
        const numericAdminChatId = Number(this.adminChatId);
        Logger.info('🔍 Проверяем админа', { 
            userId, 
            adminChatId: this.adminChatId,
            numericAdminChatId,
            isAdmin: userId === numericAdminChatId 
        });
        if (userId === numericAdminChatId) {
            Logger.info('🔍 Пропускаем админа', { userId });
            continue;
        }
            
            Logger.info('🔍 Обрабатываем пользователя', { userId, alreadySent: sentUsers.has(userId) });
            
            if (sentUsers.has(userId)) {
                Logger.warn('🔍 Пропускаем дубликат', { userId });
                continue;
            }

            try {
                Logger.info('📤 Отправляем сообщение', { userId });
                await this.bot.sendMessage(userId, message);
                successCount++;
                sentUsers.add(userId);
                Logger.info('✅ Сообщение отправлено', { userId, successCount });
                
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                failCount++;
                Logger.error('❌ Ошибка отправки', { userId, error: error.message });
                
                if (error.code === 'ETELEGRAM' && error.message.includes('chat not found')) {
                    blockedCount++;
                    Logger.warn(`Пользователь ${userId} заблокировал бота или не существует`, { userId, error: error.message });
                } else {
                    Logger.error(`Ошибка отправки пользователю ${userId}`, error);
                }
            }
        }

        const summaryMessage = `📊 Рассылка завершена!

✅ Успешно отправлено: ${successCount}
❌ Ошибки: ${failCount}
🚫 Заблокировали бота: ${blockedCount}
📝 Текст сообщения:
${message}`;

        this.bot.sendMessage(adminChatId, summaryMessage);

        Logger.info('🔍 Финальная статистика рассылки', { 
            allUsers: allUsers, 
            allUsersType: typeof allUsers, 
            allUsersLength: allUsers ? allUsers.length : 'undefined',
            allUsersIsArray: Array.isArray(allUsers),
            successCount,
            failCount,
            blockedCount
        });
        
        const userCount = allUsers && allUsers.length ? allUsers.length : 0;
        Logger.adminAction(`отправил рассылку ${userCount} пользователям`, adminChatId);
    }

    editMessageToRemoveButtons(message, newText) {
        try {
            this.bot.editMessageCaption(newText, {
                chat_id: message.chat.id,
                message_id: message.message_id
            });
        } catch (error) {
            Logger.warn('Не удалось отредактировать сообщение', { error: error.message });
        }
    }

    showSettings(chatId) {
        const message = `⚙️ Настройки бота

🔑 ID канала: ${process.env.CHANNEL_ID || 'не установлен'}
👤 ID админа: ${this.adminChatId}
🌐 Версия: 1.0.0

Используйте переменные окружения для изменения настроек.`;

        this.bot.sendMessage(chatId, message);
    }

    notifyAdmin(userChatId, paymentInfo) {
        const message = `💰 Новый платеж!

👤 Пользователь: ${paymentInfo.username || 'без username'}
📅 Период: ${paymentInfo.period}
💰 Сумма: ${paymentInfo.amount}₽
🆔 Chat ID: ${userChatId}
📸 Фото: ${paymentInfo.photoFileId ? '✅' : '❌'}`;

        this.bot.sendMessage(this.adminChatId, message);
    }

    getUptime() {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        
        return `${hours}ч ${minutes}м ${seconds}с`;
    }
}

module.exports = AdminService;
