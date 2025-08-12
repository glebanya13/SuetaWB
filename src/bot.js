const TelegramBot = require('node-telegram-bot-api');
const config = require('./config/bot.config');
const UserService = require('./services/user.service');
const AdminService = require('./services/admin.service');
const CommandHandler = require('./handlers/command.handler');
const CallbackHandler = require('./handlers/callback.handler');
const Logger = require('./utils/logger');

class SuetaWBBot {
    constructor() {
        this.bot = new TelegramBot(config.bot.token, { polling: config.bot.polling });
        this.userService = new UserService();
        this.adminService = null;
        this.commandHandler = new CommandHandler(this.bot, this.userService);
        this.callbackHandler = new CallbackHandler(this.bot, this.userService, this.commandHandler);

        this.setupBot();
        this.setupAdminPanel();
    }

    setupBot() {
        this.bot.onText(/\/start/, (msg) => {
            try {
                const isAdmin = config.admin.chatId && msg.chat.id.toString() === config.admin.chatId.toString();

                if (isAdmin) {
                    this.adminService.showAdminMenu(msg.chat.id);
                    Logger.adminAction('запустил бота (админ)', msg.chat.id);
                    return;
                } else {
                    this.commandHandler.handleStart(msg);
                    Logger.userAction('запустил бота', msg.chat.id, msg.from.username);
                }
            } catch (error) {
                Logger.error('Ошибка обработки команды /start', error);
            }
        });

        this.bot.on('message', async (msg) => {
            try {
                await this.handleMessage(msg);
            } catch (error) {
                Logger.error('Ошибка обработки сообщения', {
                    error: error.message,
                    stack: error.stack,
                    chatId: msg?.chat?.id,
                    messageType: msg?.text ? 'text' : msg?.photo ? 'photo' : 'other',
                    messageLength: msg?.text?.length || 0,
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.bot.on('callback_query', async (query) => {
            try {
                await this.handleCallback(query);
            } catch (error) {
                Logger.error('Ошибка обработки callback', {
                    error: error.message,
                    stack: error.stack,
                    chatId: query?.message?.chat?.id,
                    callbackData: query?.data,
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.bot.on('polling_error', (error) => {
            Logger.logNetworkError('polling', error);
        });

        this.bot.on('error', (error) => {
            Logger.logTelegramError('general', error);
        });
    }

    setupAdminPanel() {
        if (config.admin.chatId) {
            this.adminService = new AdminService(this.bot, this.userService, config.admin.chatId);
            this.adminService.setupAdminCommands();
            Logger.adminAction('панель активирована', config.admin.chatId);
        } else {
            Logger.warn('Админ-панель отключена - ADMIN_CHAT_ID не установлен');
        }
    }

    async handleMessage(msg) {
        const chatId = msg.chat.id;
        const text = msg.text;

        Logger.debug('Обрабатываем сообщение', {
            chatId,
            messageType: text ? 'text' : msg.photo ? 'photo' : 'other',
            textLength: text?.length || 0,
            hasPhoto: !!msg.photo,
            timestamp: new Date().toISOString()
        });

        const isAdmin = config.admin.chatId && chatId.toString() === config.admin.chatId.toString();

        if (isAdmin) {
            if (text === '/admin') {
                this.adminService.showAdminMenu(chatId);
                return;
            }
            if (text && text.startsWith('/')) {
                return;
            }

            if (this.adminService) {
                if (this.adminService.waitingForBroadcast) {
                    if (!text) {
                        Logger.warn('Попытка отправить рассылку без текста', { chatId, messageType: msg.photo ? 'photo' : 'other' });
                        this.bot.sendMessage(chatId, '❌ Для рассылки нужен текст сообщения');
                        return;
                    }
                    Logger.debug('Обрабатываем рассылку', { chatId, messageLength: text.length });
                    await this.adminService.sendBroadcast(text, chatId);
                } else {
                    if (!text) {
                        Logger.warn('Попытка обработать админскую кнопку без текста', { chatId, messageType: msg.photo ? 'photo' : 'other' });
                        return;
                    }
                    this.adminService.handleAdminButton(chatId, text);
                }
            }
            return;
        }

        if (!this.userService.getState(chatId)) {
            this.userService.setState(chatId, 'main_menu');
        }

        const currentState = this.userService.getState(chatId);

        switch (currentState) {
            case 'main_menu':
                if (text) {
                    this.commandHandler.handleMainMenu(chatId, text);
                } else if (msg.photo) {
                    Logger.debug('Пользователь отправил фото в главном меню', { chatId });
                    this.bot.sendMessage(chatId, '📸 В главном меню принимаются только текстовые сообщения. Выберите один из пунктов меню.');
                }
                break;

            case 'waiting_payment_screenshot':
                const paymentInfo = this.commandHandler.handlePaymentScreenshot(chatId, msg);
                Logger.info('🚨 Получен paymentInfo от handlePaymentScreenshot', { chatId, paymentInfo });
                if (paymentInfo && this.adminService) {
                    Logger.info('🚨 ВЫЗЫВАЕМ addPendingPayment', { chatId, paymentInfo });
                    this.adminService.addPendingPayment(chatId, paymentInfo);
                    Logger.info('Payment screenshot received', { chatId, username: paymentInfo.username });
                } else {
                    Logger.warn('🚨 paymentInfo пустой или adminService недоступен', { chatId, paymentInfo, hasAdminService: !!this.adminService });
                }
                break;

            default:
                this.userService.resetToMainMenu(chatId);
                break;
        }
    }

    async handleCallback(query) {
        const chatId = query.message.chat.id;
        const data = query.data;

        const isAdmin = config.admin.chatId && chatId.toString() === config.admin.chatId.toString();

        if (isAdmin) {
            Logger.callbackEvent(data, chatId, true);
            this.adminService.handleAdminCallback(query);
        } else {
            Logger.callbackEvent(data, chatId, false);
            this.callbackHandler.handleCallback(query);
        }
    }

    start() {
        Logger.botStart();
        Logger.info('📱 Используйте /start для начала работы');

        process.on('SIGINT', () => {
            Logger.botStop();
            this.bot.stopPolling();
            if (this.userService) {
                this.userService.close();
            }
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            Logger.botStop();
            this.bot.stopPolling();
            if (this.userService) {
                this.userService.close();
            }
            process.exit(0);
        });
    }
}

module.exports = SuetaWBBot;
