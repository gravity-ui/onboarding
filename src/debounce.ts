export const createControlledPromise = () => {
    let resolveFn = () => {};
    const promise = new Promise<void>((resolve) => {
        resolveFn = resolve;
    });

    return {resolve: resolveFn, promise};
};

export const createDebounceHandler = (targetFn: () => void, timeout: number) => {
    let timeoutId: NodeJS.Timeout | undefined;
    let controlledPromise = createControlledPromise();

    return function trigger() {
        if (timeoutId === undefined) {
            controlledPromise = createControlledPromise();
        } else {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            timeoutId = undefined;
            const pending = controlledPromise;
            targetFn();
            pending.resolve();
        }, timeout);

        return controlledPromise.promise;
    };
};
