export const createControlledPromise = () => {
    let resolveFn = () => {};
    const promise = new Promise<void>((resolve) => {
        resolveFn = resolve;
    });

    return {resolve: resolveFn, promise};
};

export const createDebounceHandler = (targetFn: () => void, timeout: number) => {
    let lastCallTime = 0;
    let currentCallTime = 0;
    let timeoutId: NodeJS.Timeout;
    let controlledPromise = createControlledPromise();

    return function trigger() {
        lastCallTime = currentCallTime;
        currentCallTime = Date.now();

        if (currentCallTime - lastCallTime < timeout) {
            clearTimeout(timeoutId);
        } else {
            controlledPromise = createControlledPromise();
        }

        timeoutId = setTimeout(() => {
            targetFn();
            controlledPromise.resolve();
        }, timeout);

        return controlledPromise.promise;
    };
};
