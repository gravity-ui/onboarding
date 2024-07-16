import {Controller} from '../core/controller';

import {testOptions} from './options';

test('priorities in one group', async () => {
    const controller = new Controller(testOptions);

    controller.requestStart('ganttPoll');
    controller.requestStart('taskPoll');
    controller.requestStart('boardPoll');

    await controller.ensureInit();

    expect(controller.state.base.activePromo).toBe('boardPoll');
    expect(controller.state.base.activeQueue).toEqual(['ganttPoll', 'taskPoll']);
});

test('priorities in two groups', async () => {
    const controller = new Controller(testOptions);

    controller.requestStart('ganttPoll2');
    controller.requestStart('taskPoll2');
    controller.requestStart('boardPoll2');

    controller.requestStart('ganttPoll');
    controller.requestStart('taskPoll');
    controller.requestStart('boardPoll');

    await controller.ensureInit();

    expect(controller.state.base.activePromo).toBe('boardPoll');
    expect(controller.state.base.activeQueue).toEqual([
        'ganttPoll',
        'taskPoll',
        'boardPoll2',
        'ganttPoll2',
        'taskPoll2',
    ]);
});

test('high priority in two groups', async () => {
    const controller = new Controller(testOptions);

    controller.requestStart('ganttPoll2');
    controller.requestStart('taskPoll2');
    controller.requestStart('boardPoll2');
    controller.requestStart('hightPoll2');

    controller.requestStart('ganttPoll');
    controller.requestStart('taskPoll');
    controller.requestStart('boardPoll');

    await controller.ensureInit();

    expect(controller.state.base.activePromo).toBe('hightPoll2');
    expect(controller.state.base.activeQueue).toEqual([
        'boardPoll',
        'ganttPoll',
        'taskPoll',
        'boardPoll2',
        'ganttPoll2',
        'taskPoll2',
    ]);
});
