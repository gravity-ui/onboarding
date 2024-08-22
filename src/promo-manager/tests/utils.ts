import dayjs from 'dayjs';

export const waitForNextTick = (timeout = 0) =>
    new Promise((resolve) => setTimeout(resolve, timeout));

export const datePlusMonthsCallback = (monthsCount: number) => {
    return () => {
        const date = dayjs();

        return date.add(monthsCount, 'month').add(1, 'second').valueOf();
    };
};
