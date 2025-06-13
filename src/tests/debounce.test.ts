import {createControlledPromise, createDebounceHandler} from '../debounce';

describe('createControlledPromise', () => {
    it('should create a promise with external resolve function', async () => {
        const {promise, resolve} = createControlledPromise();
        let resolved = false;

        promise.then(() => {
            resolved = true;
        });

        expect(resolved).toBe(false);
        resolve();
        await promise;
        expect(resolved).toBe(true);
    });

    it('should allow multiple controlled promises', async () => {
        const promise1 = createControlledPromise();
        const promise2 = createControlledPromise();

        let resolved1 = false;
        let resolved2 = false;

        promise1.promise.then(() => {
            resolved1 = true;
        });
        promise2.promise.then(() => {
            resolved2 = true;
        });

        promise1.resolve();
        await promise1.promise;
        expect(resolved1).toBe(true);
        expect(resolved2).toBe(false);

        promise2.resolve();
        await promise2.promise;
        expect(resolved2).toBe(true);
    });
});

describe('createDebounceHandler', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should debounce function calls', () => {
        const mockFn = jest.fn();
        const debouncedFn = createDebounceHandler(mockFn, 100);

        debouncedFn();
        debouncedFn();
        debouncedFn();

        expect(mockFn).not.toHaveBeenCalled();

        jest.advanceTimersByTime(100);
        expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should reset timeout on subsequent calls within timeout period', () => {
        const mockFn = jest.fn();
        const debouncedFn = createDebounceHandler(mockFn, 100);

        debouncedFn();
        jest.advanceTimersByTime(50);
        debouncedFn();
        jest.advanceTimersByTime(50);

        expect(mockFn).not.toHaveBeenCalled();

        jest.advanceTimersByTime(50);
        expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should return promise that resolves when function executes', async () => {
        const mockFn = jest.fn();
        const debouncedFn = createDebounceHandler(mockFn, 100);

        const promise = debouncedFn();
        let resolved = false;

        promise.then(() => {
            resolved = true;
        });

        expect(resolved).toBe(false);
        jest.advanceTimersByTime(100);
        await promise;
        expect(resolved).toBe(true);
        expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple calls with different promises', async () => {
        const mockFn = jest.fn();
        const debouncedFn = createDebounceHandler(mockFn, 100);

        const promise1 = debouncedFn();
        jest.advanceTimersByTime(50);
        const promise2 = debouncedFn();

        let resolved1 = false;
        let resolved2 = false;

        promise1.then(() => {
            resolved1 = true;
        });
        promise2.then(() => {
            resolved2 = true;
        });

        jest.advanceTimersByTime(100);
        await Promise.all([promise1, promise2]);

        expect(resolved1).toBe(true);
        expect(resolved2).toBe(true);
        expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should handle calls separated by more than timeout period', () => {
        const mockFn = jest.fn();
        const debouncedFn = createDebounceHandler(mockFn, 100);

        debouncedFn();
        jest.advanceTimersByTime(100);
        expect(mockFn).toHaveBeenCalledTimes(1);

        debouncedFn();
        jest.advanceTimersByTime(100);
        expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should create new controlled promise for calls after timeout', async () => {
        const mockFn = jest.fn();
        const debouncedFn = createDebounceHandler(mockFn, 100);

        const promise1 = debouncedFn();
        jest.advanceTimersByTime(150);
        const promise2 = debouncedFn();

        jest.advanceTimersByTime(100);

        await promise1;
        await promise2;

        expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should handle zero timeout', () => {
        const mockFn = jest.fn();
        const debouncedFn = createDebounceHandler(mockFn, 0);

        debouncedFn();
        expect(mockFn).not.toHaveBeenCalled();

        jest.advanceTimersByTime(0);
        expect(mockFn).toHaveBeenCalledTimes(1);
    });
});
