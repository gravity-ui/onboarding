import {Controller} from '../core/controller';

import {testOptions} from './options';
import {waitForNextTick} from './utils';

test('add two same promo -> no duplicates in queue', async () => {
    const controller = new Controller(testOptions);

    controller.requestStart('boardPoll');
    controller.requestStart('ganttPoll');
    controller.requestStart('ganttPoll');

    await waitForNextTick();

    expect(controller.state.base.activeQueue.length).toBe(1);
});

test('finish promo -> remove it from queue', async () => {
    const controller = new Controller(testOptions);

    controller.requestStart('boardPoll');
    controller.requestStart('ganttPoll');
    controller.finishPromo('ganttPoll');

    await waitForNextTick();

    expect(controller.state.base.activeQueue.length).toBe(0);
});

test('add finished promo -> queue is empty', async () => {
    const controller = new Controller(testOptions);

    controller.requestStart('boardPoll');
    controller.requestStart('ganttPoll');
    controller.finishPromo('ganttPoll');
    controller.requestStart('ganttPoll');

    await waitForNextTick();

    expect(controller.state.base.activeQueue.length).toBe(0);
});

test('cancel promo and trigger next -> cancelled in queue, next is active', async () => {
    const controller = new Controller(testOptions);

    controller.requestStart('boardPoll');
    controller.requestStart('ganttPoll');
    controller.cancelPromo('boardPoll');

    await waitForNextTick();

    expect(controller.state.base.activePromo).toEqual('ganttPoll');
});

test('priority of boardPoll is higher -> boardPoll is active', async () => {
    const controller = new Controller(testOptions);

    controller.requestStart('everyDayPoll');
    controller.requestStart('ganttPoll');
    controller.requestStart('boardPoll');

    await waitForNextTick();

    expect(controller.state.base.activePromo).toBe('boardPoll');
});
