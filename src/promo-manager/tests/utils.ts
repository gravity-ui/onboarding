export const waitForNextTick = (timeout = 0) =>
    new Promise((resolve) => setTimeout(resolve, timeout));
