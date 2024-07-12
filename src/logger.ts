type LogLevel = 'debug' | 'error';

export type Logger = {
    log: (...args: Array<unknown>) => void;
    error: (...args: Array<unknown>) => void;
};

export type LoggerOptions = {
    level?: LogLevel;
    logger?: Logger;
    context?: string;
};
const noop = () => {};
export const createLogger = ({
    level = 'error',
    logger = console,
    context = 'Onboarding',
}: LoggerOptions) => {
    return {
        debug:
            level === 'debug' ? (...args: unknown[]) => logger?.log(`[${context}]`, ...args) : noop,
        error: logger.error,
    };
};
