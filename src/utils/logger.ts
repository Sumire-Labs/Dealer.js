type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function formatTimestamp(): string {
    return new Date().toISOString();
}

function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    const entry = {
        timestamp: formatTimestamp(),
        level,
        message,
        ...data,
    };
    const output = JSON.stringify(entry);

    switch (level) {
        case 'error':
            console.error(output);
            break;
        case 'warn':
            console.warn(output);
            break;
        default:
            console.log(output);
            break;
    }
}

export const logger = {
    debug: (message: string, data?: Record<string, unknown>) => log('debug', message, data),
    info: (message: string, data?: Record<string, unknown>) => log('info', message, data),
    warn: (message: string, data?: Record<string, unknown>) => log('warn', message, data),
    error: (message: string, data?: Record<string, unknown>) => log('error', message, data),
};
