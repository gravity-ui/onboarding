export const isQuotaExceededError = (err: unknown): boolean => {
    return (
        err instanceof DOMException &&
        // everything except Firefox
        (err.code === 22 ||
            // Firefox
            err.code === 1014 ||
            // test name field too, because code might not be present
            // everything except Firefox
            err.name === 'QuotaExceededError' ||
            // Firefox
            err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    );
};
