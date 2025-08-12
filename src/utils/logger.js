class BotLogger {
    constructor() {
        this.setLogLevel();
    }

    setLogLevel() {
        const env = process.env.NODE_ENV || 'production';

        switch (env) {
            case 'development':
                this.currentLevel = 'debug';
                break;
            case 'test':
                this.currentLevel = 'warn';
                break;
            default:
                this.currentLevel = 'info';
        }
    }

    getLevelPriority(level) {
        const priorities = {
            'fatal': 0,
            'error': 1,
            'warn': 2,
            'info': 3,
            'debug': 4
        };
        return priorities[level] || 5;
    }

    shouldLog(level) {
        return this.getLevelPriority(level) <= this.getLevelPriority(this.currentLevel);
    }

    formatTimestamp() {
        return new Date().toLocaleString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    getLevelEmoji(level) {
        const emojis = {
            'fatal': '💀',
            'error': '❌',
            'warn': '⚠️',
            'info': 'ℹ️',
            'debug': '🔍'
        };
        return emojis[level] || '📝';
    }

    formatMessage(level, message, data = null) {
        const timestamp = this.formatTimestamp();
        const emoji = this.getLevelEmoji(level);
        const levelUpper = level.toUpperCase().padEnd(5);

        let formattedMessage = `${emoji} [${timestamp}] ${levelUpper} ${message}`;

        if (data) {
            formattedMessage += '\n' + this.formatData(data);
        }

        return formattedMessage;
    }

    log(level, message, data = null) {
        if (!this.shouldLog(level)) return;

        const formattedMessage = this.formatMessage(level, message, data);

        switch (level) {
            case 'fatal':
            case 'error':
                console.error(formattedMessage);
                break;
            case 'warn':
                console.warn(formattedMessage);
                break;
            case 'info':
            case 'debug':
            default:
                console.log(formattedMessage);
                break;
        }
    }

    info(message, data = null) {
        this.log('info', message, data);
    }

    error(message, error = null) {
        this.log('error', message, error);
    }

    warn(message, data = null) {
        this.log('warn', message, data);
    }

    debug(message, data = null) {
        this.log('debug', message, data);
    }

    fatal(message, error = null) {
        this.log('fatal', message, error);
    }

    botStart() {
        this.info('🤖 SuetaWB Bot запускается...');
    }

    botStop() {
        this.info('🛑 SuetaWB Bot останавливается...');
    }

    userAction(action, chatId, username = null) {
        const userInfo = username ? `@${username}` : `ID:${chatId}`;
        this.info(`👤 Пользователь ${userInfo}: ${action}`);
    }

    adminAction(action, adminChatId) {
        this.info(`🔧 Админ ${adminChatId}: ${action}`);
    }

    paymentEvent(event, chatId, amount = null, period = null) {
        let message = `💰 ${event}`;
        if (amount && period) {
            message += ` - ${period} (${amount}₽)`;
        }
        message += ` | Chat ID: ${chatId}`;
        this.info(message);
    }

    callbackEvent(callbackData, chatId, isAdmin = false) {
        const prefix = isAdmin ? '🔧 Админ' : '👤 Пользователь';
        this.debug(`${prefix} callback: ${callbackData} | Chat ID: ${chatId}`);
    }

    formatData(data) {
        if (typeof data === 'object') {
            try {
                return JSON.stringify(data, null, 2);
            } catch (e) {
                return String(data);
            }
        }
        return String(data);
    }

    formatError(error) {
        if (error instanceof Error) {
            return {
                message: error.message,
                stack: error.stack,
                name: error.name
            };
        }
        return String(error);
    }

    logStats(stats) {
        this.info('📊 Статистика бота:', stats);
    }

    logUptime(uptime) {
        this.info(`⏱️ Время работы бота: ${uptime}`);
    }

    logNetworkError(operation, error) {
        this.error(`🌐 Ошибка сети при ${operation}:`, error);
    }

    logTelegramError(operation, error) {
        this.error(`📱 Ошибка Telegram API при ${operation}:`, error);
    }
}

const botLogger = new BotLogger();

module.exports = botLogger;
