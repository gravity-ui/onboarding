type LogLevel = 'debug' | 'error';

type Logger = {
    log: (...args: Array<unknown>) => void;
    error: (...args: Array<unknown>) => void;
};

export type LoggerOptions = {
    level?: LogLevel;
    logger?: Logger;
};

const noop = () => {};

export const createLogger = ({level = 'error', logger = console}: LoggerOptions) => {
    return {
        debug:
            level === 'debug' ? (...args: unknown[]) => logger.log('[Onboarding]', ...args) : noop,
        error: logger.error,
    };
};
