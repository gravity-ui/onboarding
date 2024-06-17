import {Controller} from '../core/controller';

import {testOptions} from './options';
import {datePlusMonthsCallback, waitForNextTick} from './utils';

test('cancel promo and request after 2 months -> show again', async () => {
    const controller = new Controller(testOptions);

    controller.requestStart('every2Months', true);

    await waitForNextTick();

    controller.cancelPromo('every2Months');
    controller.requestStart('every2Months', true);

    await waitForNextTick();

    expect(controller.state.base.activePromo).toBe(null);

    controller.dateNow = datePlusMonthsCallback(2);

    controller.requestStart('every2Months', true);

    await waitForNextTick();

    expect(controller.state.base.activePromo).toBe('every2Months');
});

test('finish promo and request after 2 months -> not show again', async () => {
    const controller = new Controller(testOptions);

    controller.requestStart('every2Months', true);

    await waitForNextTick();

    controller.finishPromo('every2Months');
    controller.requestStart('every2Months', true);

    await waitForNextTick();

    expect(controller.state.base.activePromo).toBe(null);

    controller.dateNow = datePlusMonthsCallback(2);

    controller.requestStart('every2Months', true);

    await waitForNextTick();

    expect(controller.state.base.activePromo).toBe(null);
});

test('show preset once per month [cancel]', async () => {
    const controller = new Controller(testOptions);

    controller.requestStart('every2Months', true);

    await waitForNextTick();

    controller.cancelPromo('every2Months');

    controller.dateNow = datePlusMonthsCallback(1);

    controller.requestStart('every2Months', true);
    controller.requestStart('every2Months2', true);

    await waitForNextTick();

    expect(controller.state.base.activePromo).toBe('every2Months2');
});

test('show preset once per month [cancel]', async () => {
    const controller = new Controller(testOptions);

    controller.requestStart('every2Months', true);
    await waitForNextTick();

    controller.finishPromo('every2Months');

    controller.dateNow = datePlusMonthsCallback(1);

    controller.requestStart('every2Months', true);
    controller.requestStart('every2Months2', true);

    await waitForNextTick();

    expect(controller.state.base.activePromo).toBe('every2Months2');
});

test('show promo and cancel -> show again in 2 months', async () => {
    const controller = new Controller(testOptions);

    controller.requestStart('every2Months', true);

    await waitForNextTick();

    controller.cancelPromo('every2Months');

    controller.dateNow = datePlusMonthsCallback(2);

    controller.requestStart('every2Months', true);
    controller.requestStart('every2Months2', true);

    await waitForNextTick();

    expect(controller.state.base.activePromo).toBe('every2Months');
});

test('show promo and finish -> show new promo in 2 months', async () => {
    const controller = new Controller(testOptions);

    controller.requestStart('every2Months', true);

    await waitForNextTick();

    controller.finishPromo('every2Months');

    controller.dateNow = datePlusMonthsCallback(2);

    controller.requestStart('every2Months', true);
    controller.requestStart('every2Months2', true);

    await waitForNextTick();

    expect(controller.state.base.activePromo).toBe('every2Months2');
});
