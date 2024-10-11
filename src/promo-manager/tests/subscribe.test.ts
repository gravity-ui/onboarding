import {Controller} from '../core/controller';
import {testOptions} from './options';
import {waitForNextTick} from './utils';

describe('trigger subscribe', () => {
    let controller: Controller;

    beforeEach(() => {
        controller = new Controller(testOptions);
    });

    it('finish with timeout => update progress info, close active', async () => {
        await controller.requestStart('boardPoll');

        const callback = jest.fn();
        controller.subscribe(callback);

        await controller.finishPromo('boardPoll', 100);

        expect(controller.state.base.activePromo).toBe('boardPoll');
        expect(controller.state.progress?.finishedPromos.includes('boardPoll')).toBe(true);
        expect(callback).toHaveBeenCalledTimes(1);

        await waitForNextTick(100);

        expect(controller.state.base.activePromo).toBe(null);
        expect(callback).toHaveBeenCalledTimes(2);
    });

    it('cancel with timeout => update progress info, close active', async () => {
        await controller.requestStart('boardPoll');

        const callback = jest.fn();
        controller.subscribe(callback);

        await controller.cancelPromo('boardPoll', 100);

        expect(controller.state.base.activePromo).toBe('boardPoll');
        expect(controller.state.progress?.progressInfoByPromo['boardPoll']).toBeDefined();
        expect(callback).toHaveBeenCalledTimes(1);

        await waitForNextTick(100);

        expect(controller.state.base.activePromo).toBe(null);
        expect(callback).toHaveBeenCalledTimes(2);
    });
});

describe('optimize subscribe', () => {
    let controller: Controller;

    beforeEach(() => {
        controller = new Controller(testOptions);
    });

    it('request start -> 1 update', async () => {
        const callback = jest.fn();

        controller.subscribe(callback);

        await controller.requestStart('boardPoll');

        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('finish -> 2 updates', async () => {
        await controller.requestStart('boardPoll');

        const callback = jest.fn();
        controller.subscribe(callback);

        await controller.finishPromo('boardPoll');

        expect(callback).toHaveBeenCalledTimes(2);
    });

    it('cancel -> 2 updates', async () => {
        await controller.requestStart('boardPoll');

        const callback = jest.fn();
        controller.subscribe(callback);

        await controller.cancelPromo('boardPoll');

        expect(callback).toHaveBeenCalledTimes(2);
    });

    it('skipPromo -> 1 update', async () => {
        await controller.requestStart('boardPoll');

        const callback = jest.fn();
        controller.subscribe(callback);

        await controller.skipPromo('boardPoll');

        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('start and finish -> 3 updates', async () => {
        const callback = jest.fn();

        controller.subscribe(callback);

        await controller.requestStart('boardPoll');
        await controller.finishPromo('boardPoll');

        expect(callback).toHaveBeenCalledTimes(3);
    });

    it('start, finish and has next -> 4 updates', async () => {
        const callback = jest.fn();

        controller.subscribe(callback);

        const promise1 = controller.requestStart('boardPoll');
        const promise2 = controller.requestStart('ganttPoll');
        await Promise.all([promise1, promise2]);

        await controller.finishPromo('boardPoll');

        expect(callback).toHaveBeenCalledTimes(4);
    });

    it('start and cancel -> 3 updates', async () => {
        const callback = jest.fn();

        controller.subscribe(callback);

        await controller.requestStart('boardPoll');
        await controller.cancelPromo('boardPoll');

        expect(callback).toHaveBeenCalledTimes(3);
    });

    it('double start and cancel -> 3 updates', async () => {
        const callback = jest.fn();

        controller.subscribe(callback);

        const promise1 = controller.requestStart('boardPoll');
        const promise2 = controller.requestStart('ganttPoll');

        await Promise.all([promise1, promise2]);

        await controller.cancelPromo('boardPoll');

        expect(callback).toHaveBeenCalledTimes(4);
    });
});
