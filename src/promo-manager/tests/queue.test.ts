import {Controller} from '../core/controller';

import {testOptions} from './options';

test('add two same promo -> no duplicates in queue', async () => {
    const controller = new Controller(testOptions);

    await controller.requestStart('boardPoll');
    await controller.requestStart('ganttPoll');
    await controller.requestStart('ganttPoll');

    await controller.ensureInit();

    expect(controller.state.base.activeQueue.length).toBe(1);
});

test('finish promo -> remove it from queue', async () => {
    const controller = new Controller(testOptions);

    await controller.requestStart('boardPoll');
    await controller.requestStart('ganttPoll');
    await controller.finishPromo('ganttPoll');

    expect(controller.state.base.activeQueue).not.toContain('ganttPoll');
});

test('add finished promo -> queue is empty', async () => {
    const controller = new Controller(testOptions);

    await controller.requestStart('boardPoll');
    await controller.requestStart('ganttPoll');
    controller.finishPromo('ganttPoll');
    await controller.requestStart('ganttPoll');

    expect(controller.state.base.activeQueue.length).toBe(0);
});

test('cancel promo and trigger next -> cancelled in queue, next is active', async () => {
    const controller = new Controller(testOptions);

    await controller.requestStart('boardPoll');
    await controller.requestStart('ganttPoll');
    controller.cancelPromo('boardPoll');

    expect(controller.state.base.activePromo).toEqual('ganttPoll');
});

test('priority of boardPoll is higher -> boardPoll is active', async () => {
    const controller = new Controller(testOptions);

    const promise1 = controller.requestStart('everyDayPoll');
    const promise2 = controller.requestStart('ganttPoll');
    const promise3 = controller.requestStart('boardPoll');

    await Promise.all([promise1, promise2, promise3]);

    expect(controller.state.base.activePromo).toBe('boardPoll');
});
