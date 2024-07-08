import {Controller} from '../core/controller';
import {testOptions} from './options';
import {pollWithConditions} from './presets';
import dayjs from 'dayjs';

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
            presets: [pollWithConditions],
        },
    };

    it('cancel promo and request after 2 months -> show again', async () => {
        const controller = new Controller(options);

        await controller.requestStart('every2Months', true);
        controller.cancelPromo('every2Months');
        await controller.requestStart('every2Months', true);

        expect(controller.state.base.activePromo).toBe(null);

        controller.dateNow = datePlusMonthsCallback(2);

        await controller.requestStart('every2Months', true);

        expect(controller.state.base.activePromo).toBe('every2Months');
    });

    it('finish promo and request after 2 months -> not show again', async () => {
        const controller = new Controller(options);

        await controller.requestStart('every2Months', true);

        controller.finishPromo('every2Months');
        await controller.requestStart('every2Months', true);

        expect(controller.state.base.activePromo).toBe(null);

        controller.dateNow = datePlusMonthsCallback(2);

        await controller.requestStart('every2Months', true);

        expect(controller.state.base.activePromo).toBe(null);
    });
});
