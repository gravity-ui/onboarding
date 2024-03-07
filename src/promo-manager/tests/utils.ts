export const waitForNextTick = (timeout = 0) =>
    new Promise((resolve) => setTimeout(resolve, timeout));

export const datePlusMonthsCallback = (monthsCount: number) => {
    return () => {
        const date = new Date();

        date.setMonth(date.getMonth() + monthsCount);

        return date.getTime();
    };
};
