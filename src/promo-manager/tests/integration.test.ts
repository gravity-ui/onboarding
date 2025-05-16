import {Controller} from '../core/controller';
import {testOptions} from './options';
import {pollGroup2, pollWithConditions} from './promoGroups';
import dayjs from 'dayjs';
import {LimitFrequency} from '../core/condition/condition-helpers';
import {PromoProgressState} from '../core/types';

const datePlusMonthsCallback = (monthsCount: number) => {
    return () => {
        const date = dayjs();

        return date.add(monthsCount, 'month').add(1, 'second').valueOf();
    };
};

describe('periodic runs', function () {
    const options = {
        ...testOptions,
        config: {
            promoGroups: [pollWithConditions],
        },
    };

    it('cancel promo and request after 2 months -> show again', async () => {
        const controller = new Controller(options);

        await controller.requestStart('every2Months');
        controller.cancelPromo('every2Months');
        await controller.requestStart('every2Months');

        expect(controller.state.base.activePromo).toBe(null);

        controller.dateNow = datePlusMonthsCallback(2);

        await controller.requestStart('every2Months');

        expect(controller.state.base.activePromo).toBe('every2Months');
    });

    it('finish promo and request after 2 months -> show again', async () => {
        const controller = new Controller(options);

        await controller.requestStart('every2Months');

        controller.finishPromo('every2Months');
        await controller.requestStart('every2Months');

        expect(controller.state.base.activePromo).toBe(null);

        controller.dateNow = datePlusMonthsCallback(2);

        await controller.requestStart('every2Months');

        expect(controller.state.base.activePromo).toBe('every2Months');
    });
});

it('LimitFrequency', async function () {
    const progressState = {
        finishedPromos: ['boardPoll2'],
        progressInfoByPromo: {
            boardPoll2: {
                lastCallTime: new Date('07-15-2024').valueOf(),
            },
        },
    };
    const controller = new Controller({
        config: {
            promoGroups: [pollGroup2],
            constraints: [
                LimitFrequency({
                    slugs: ['boardPoll2', 'ganttPoll2'],
                    interval: {weeks: 1},
                }),
            ],
        },
        progressState: progressState,
        getProgressState: () => new Promise<PromoProgressState>(() => progressState),
        onSave: {
            progress: () => new Promise(() => {}),
        },
    });
    controller.dateNow = () => new Date('07-15-2024').valueOf();

    await controller.requestStart('ganttPoll2');

    expect(controller.state.base.activePromo).toBe(null);
});
