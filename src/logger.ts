type LogLevel = 'debug' | 'error';

export type Logger = {
    debug: (...args: Array<unknown>) => void;
    error: (...args: Array<unknown>) => void;
};

export type LoggerOptions = {
    level?: LogLevel;
    logger?: Logger;
    context?: string;
};
const noop = () => {};
export const createLogger = ({level = 'error', logger = console, context}: LoggerOptions) => {
    return {
        debug:
            level === 'debug'
                ? (...args: unknown[]) => logger?.debug(`[${context}]`, ...args)
                : noop,
        error: logger.error,
    };
};
