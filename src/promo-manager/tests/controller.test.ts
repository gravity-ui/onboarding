import {Controller} from '../core/controller';

import {testOptions} from './options';
import {testMetaInfo} from './promoGroups';
import {waitForNextTick} from './utils';

describe('active promo', () => {
    let controller: Controller;

    beforeEach(() => {
        controller = new Controller(testOptions);
    });

    describe('requestStart', function () {
        test('run one promo', async () => {
            await controller.requestStart('boardPoll');

            expect(controller.state.base.activePromo).toBe('boardPoll');
        });

        test('run one promo not from the config', async () => {
            await controller.requestStart('boardPollFake');

            expect(controller.state.base.activePromo).toBe(null);
        });

        it('wait init, then start', async function () {
            controller.requestStart('boardPoll');
            await controller.ensureInit();

            expect(controller.state.base.activePromo).toBe('boardPoll');
        });

        it('can start now -> return true', async function () {
            const result = await controller.requestStart('boardPoll');

            expect(result).toBe(true);
        });

        it('undefined promo -> return false', async function () {
            const result = await controller.requestStart('boardPollFake');

            expect(result).toBe(false);
        });

        it("can't start now -> return false", async function () {
            await controller.requestStart('boardPoll');
            const result = await controller.requestStart('ganttPoll');

            expect(result).toBe(false);
        });
    });

    it('finish promo -> trigger next', async () => {
        await controller.requestStart('boardPoll');
        await controller.requestStart('ganttPoll');

        await controller.finishPromo('boardPoll');

        expect(controller.state.base.activePromo).toBe('ganttPoll');
    });

    it('run 2 duplicates -> finish promo -> not trigger next', async () => {
        await controller.requestStart('boardPoll');
        await controller.requestStart('boardPoll');

        controller.finishPromo('boardPoll');

        expect(controller.state.base.activePromo).toBe(null);
    });
});

describe('trigger subscribe', () => {
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

    it('finish -> 1 update', async () => {
        await controller.requestStart('boardPoll');

        const callback = jest.fn();
        controller.subscribe(callback);

        await controller.finishPromo('boardPoll');

        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('cancel -> 1 update', async () => {
        await controller.requestStart('boardPoll');

        const callback = jest.fn();
        controller.subscribe(callback);

        await controller.cancelPromo('boardPoll');

        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('cancelStart -> 1 update', async () => {
        await controller.requestStart('boardPoll');

        const callback = jest.fn();
        controller.subscribe(callback);

        await controller.cancelStart('boardPoll');

        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('start and finish -> 2 updates', async () => {
        const callback = jest.fn();

        controller.subscribe(callback);

        await controller.requestStart('boardPoll');
        await controller.finishPromo('boardPoll');

        expect(callback).toHaveBeenCalledTimes(2);
    });

    it('start, finish and has next -> 3 updates', async () => {
        const callback = jest.fn();

        controller.subscribe(callback);

        const promise1 = controller.requestStart('boardPoll');
        const promise2 = controller.requestStart('ganttPoll');

        await Promise.all([promise1, promise2]);

        await controller.finishPromo('boardPoll');

        expect(callback).toHaveBeenCalledTimes(3);
    });

    it('start and cancel -> 2 updates', async () => {
        const callback = jest.fn();

        controller.subscribe(callback);

        await controller.requestStart('boardPoll');
        await controller.cancelPromo('boardPoll');

        expect(callback).toHaveBeenCalledTimes(2);
    });

    it('double start and cancel -> 3 updates', async () => {
        const callback = jest.fn();

        controller.subscribe(callback);

        const promise1 = controller.requestStart('boardPoll');
        const promise2 = controller.requestStart('ganttPoll');

        await Promise.all([promise1, promise2]);

        await controller.cancelPromo('boardPoll');

        expect(callback).toHaveBeenCalledTimes(3);
    });
});

describe('update last call info', () => {
    let controller: Controller;
    const promo = 'boardPoll';
    const promoType = 'poll';

    beforeEach(async () => {
        controller = new Controller(testOptions);
        await controller.requestStart(promo);
    });

    it('finish and save time', () => {
        controller.finishPromo(promo);

        expect(
            controller.state.progress?.progressInfoByPromoGroup[promoType]?.lastCallTime,
        ).toBeDefined();
        expect(controller.state.progress?.progressInfoByPromo[promo]?.lastCallTime).toBeDefined();
    });

    it('cancel and save time', () => {
        controller.cancelPromo(promo);

        expect(
            controller.state.progress?.progressInfoByPromoGroup[promoType]?.lastCallTime,
        ).toBeDefined();
        expect(controller.state.progress?.progressInfoByPromo[promo]?.lastCallTime).toBeDefined();
    });
});

describe('close with timeout', () => {
    let controller: Controller;
    const promo = 'boardPoll';
    const promoType = 'poll';
    const clearActiveTimeout = 1000;

    beforeEach(async () => {
        controller = new Controller(testOptions);
        await controller.requestStart(promo);
    });

    it('finish and save time', async () => {
        controller.finishPromo(promo, clearActiveTimeout);

        expect(
            controller.state.progress?.progressInfoByPromoGroup[promoType]?.lastCallTime,
        ).toBeDefined();
        expect(controller.state.progress?.progressInfoByPromo[promo]?.lastCallTime).toBeDefined();
        expect(controller.state.base.activePromo).toBe(promo);

        await waitForNextTick(clearActiveTimeout);

        expect(controller.state.base.activePromo).toBe(null);
    });

    it('cancel and save time', async () => {
        jest.useFakeTimers();
        controller.cancelPromo(promo, clearActiveTimeout);

        expect(
            controller.state.progress?.progressInfoByPromoGroup[promoType]?.lastCallTime,
        ).toBeDefined();
        expect(controller.state.progress?.progressInfoByPromo[promo]?.lastCallTime).toBeDefined();
        expect(controller.state.base.activePromo).toBe(promo);

        jest.advanceTimersByTime(clearActiveTimeout);
        jest.useRealTimers();

        expect(controller.state.base.activePromo).toBe(null);
    });
});

describe('meta info', () => {
    let controller: Controller;
    const promo = 'boardPoll';

    beforeEach(async () => {
        controller = new Controller(testOptions);
        controller.requestStart(promo);

        await controller.ensureInit();
    });

    it('promo with meta info', async () => {
        const metaInfo = controller.getPromoMeta('boardPoll');

        expect(metaInfo).toEqual(testMetaInfo);
    });

    it('promo without with meta info', async () => {
        const metaInfo = controller.getPromoMeta('ganttPoll');

        expect(metaInfo).toEqual({});
    });
});
