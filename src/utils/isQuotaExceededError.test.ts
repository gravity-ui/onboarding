import {isQuotaExceededError} from './isQuotaExceededError';

describe('isQuotaExceededError', () => {
    it('should detect Firefox quota exceeded error by code 1014', () => {
        const error = new DOMException('Storage quota exceeded', 'NS_ERROR_DOM_QUOTA_REACHED');
        Object.defineProperty(error, 'code', {value: 1014});

        expect(isQuotaExceededError(error)).toBe(true);
    });

    it('should detect Chrome quota exceeded error by code 22', () => {
        const error = new DOMException('Storage quota exceeded', 'QuotaExceededError');
        Object.defineProperty(error, 'code', {value: 22});

        expect(isQuotaExceededError(error)).toBe(true);
    });

    it('should detect quota exceeded error by name QuotaExceededError', () => {
        const error = new DOMException('Storage quota exceeded', 'QuotaExceededError');

        expect(isQuotaExceededError(error)).toBe(true);
    });

    it('should detect Firefox quota exceeded error by name NS_ERROR_DOM_QUOTA_REACHED', () => {
        const error = new DOMException('Storage quota exceeded', 'NS_ERROR_DOM_QUOTA_REACHED');

        expect(isQuotaExceededError(error)).toBe(true);
    });

    it('should handle DOMException with both code and name matching', () => {
        const error = new DOMException('Storage quota exceeded', 'QuotaExceededError');
        Object.defineProperty(error, 'code', {value: 22});

        expect(isQuotaExceededError(error)).toBe(true);
    });

    it('should return false for non-DOMException errors', () => {
        const error = new Error('Regular error');

        expect(isQuotaExceededError(error)).toBe(false);
    });

    it('should return false for DOMException with different code and name', () => {
        const error = new DOMException('Different error', 'NetworkError');
        Object.defineProperty(error, 'code', {value: 19});

        expect(isQuotaExceededError(error)).toBe(false);
    });

    it('should handle DOMException without code property', () => {
        const error = new DOMException('Storage quota exceeded', 'QuotaExceededError');
        delete (error as any).code;

        expect(isQuotaExceededError(error)).toBe(true);
    });
});
