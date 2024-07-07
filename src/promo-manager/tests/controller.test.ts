import {Controller} from '../core/controller';

import {testOptions} from './options';
import {testMetaInfo} from './presets';
import {waitForNextTick} from './utils';

describe('active promo', () => {
    let controller: Controller;

    beforeEach(() => {
        controller = new Controller(testOptions);
    });

    test('run one promo', async () => {
        controller.requestStart('boardPoll');

        await waitForNextTick();

        expect(controller.state.base.activePromo).toBe('boardPoll');
    });

    test('run one promo not from the config', async () => {
        controller.requestStart('boardPollFake');

        await waitForNextTick();

        expect(controller.state.base.activePromo).toBe(null);
    });

    it('finish promo -> trigger next', async () => {
        controller.requestStart('boardPoll');
        controller.requestStart('ganttPoll');

        await waitForNextTick();

        controller.finishPromo('boardPoll');

        expect(controller.state.base.activePromo).toBe('ganttPoll');
    });

    it('run 2 duplicates -> finish promo -> not trigger next', async () => {
        controller.requestStart('boardPoll');
        controller.requestStart('boardPoll');

        await waitForNextTick();

        controller.finishPromo('boardPoll');

        expect(controller.state.base.activePromo).toBe(null);
    });
});

describe('trigger subscribe', () => {
    let controller: Controller;

    beforeEach(() => {
        controller = new Controller(testOptions);
    });

    it('request promo -> no callback', () => {
        const callback = jest.fn();

        controller.subscribe(callback);

        controller.requestStart('boardPoll');

        expect(callback).toHaveBeenCalledTimes(0);
    });

    it('request promo and wait for next tick -> 1 update', async () => {
        const callback = jest.fn();

        controller.subscribe(callback);

        controller.requestStart('boardPoll');

        await waitForNextTick();
        // wait for trigger next promo and debounce
        await waitForNextTick(100);

        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('start and finish immediately -> 1 update', async () => {
        const callback = jest.fn();

        controller.subscribe(callback);

        controller.requestStart('boardPoll');
        controller.finishPromo('boardPoll');

        await waitForNextTick();
        // wait for trigger next promo and debounce
        await waitForNextTick(100);

        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('start and finish -> 2 updates', async () => {
        const callback = jest.fn();

        controller.subscribe(callback);

        controller.requestStart('boardPoll');
        controller.requestStart('ganttPoll');

        await waitForNextTick();
        // wait for trigger next promo and debounce
        await waitForNextTick(100);

        controller.finishPromo('boardPoll');

        await waitForNextTick(100);

        expect(callback).toHaveBeenCalledTimes(2);
    });

    it('start and cancel -> 2 updates', async () => {
        const callback = jest.fn();

        controller.subscribe(callback);

        controller.requestStart('boardPoll');

        await waitForNextTick();
        // wait for trigger next promo and debounce
        await waitForNextTick(100);

        controller.cancelPromo('boardPoll');

        await waitForNextTick(100);

        expect(callback).toHaveBeenCalledTimes(2);
    });

    it('double start and cancel -> 2 updates', async () => {
        const callback = jest.fn();

        controller.subscribe(callback);

        controller.requestStart('boardPoll');
        controller.requestStart('ganttPoll');

        await waitForNextTick();
        // wait for trigger next promo and debounce
        await waitForNextTick(100);

        controller.cancelPromo('boardPoll');

        await waitForNextTick(100);

        expect(callback).toHaveBeenCalledTimes(2);
    });

    it('double start and cancel without next tick -> 1 update', async () => {
        const callback = jest.fn();

        controller.subscribe(callback);

        controller.requestStart('boardPoll');
        controller.requestStart('ganttPoll');
        controller.cancelPromo('boardPoll');

        await waitForNextTick();
        // wait for trigger next promo and debounce
        await waitForNextTick(100);

        expect(callback).toHaveBeenCalledTimes(1);
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

    it('activate => not save time', () => {
        expect(
            controller.state.progress?.progressInfoByType[promoType]?.lastCallTime,
        ).toBeUndefined();
        expect(controller.state.progress?.progressInfoByPromo[promo]?.lastCallTime).toBeUndefined();
    });

    it('finish and save time', () => {
        controller.finishPromo(promo);

        expect(
            controller.state.progress?.progressInfoByType[promoType]?.lastCallTime,
        ).toBeDefined();
        expect(controller.state.progress?.progressInfoByPromo[promo]?.lastCallTime).toBeDefined();
    });

    it('cancel and save time', () => {
        controller.cancelPromo(promo, true);

        expect(
            controller.state.progress?.progressInfoByType[promoType]?.lastCallTime,
        ).toBeDefined();
        expect(controller.state.progress?.progressInfoByPromo[promo]?.lastCallTime).toBeDefined();
    });

    it('cancel and not save time', () => {
        controller.cancelPromo(promo);

        expect(
            controller.state.progress?.progressInfoByType[promoType]?.lastCallTime,
        ).toBeUndefined();
        expect(controller.state.progress?.progressInfoByPromo[promo]?.lastCallTime).toBeUndefined();
    });
});

describe('close with timeout', () => {
    let controller: Controller;
    const promo = 'boardPoll';
    const promoType = 'poll';
    const clearActiveTimeout = 1000;

    beforeEach(async () => {
        controller = new Controller(testOptions);
        controller.requestStart(promo);

        await waitForNextTick();
    });

    it('finish and save time', async () => {
        controller.finishPromo(promo, clearActiveTimeout);

        expect(
            controller.state.progress?.progressInfoByType[promoType]?.lastCallTime,
        ).toBeDefined();
        expect(controller.state.progress?.progressInfoByPromo[promo]?.lastCallTime).toBeDefined();
        expect(controller.state.base.activePromo).toBe(promo);

        await waitForNextTick(clearActiveTimeout);

        expect(controller.state.base.activePromo).toBe(null);
    });

    it('cancel and save time', async () => {
        controller.cancelPromo(promo, true, clearActiveTimeout);

        expect(
            controller.state.progress?.progressInfoByType[promoType]?.lastCallTime,
        ).toBeDefined();
        expect(controller.state.progress?.progressInfoByPromo[promo]?.lastCallTime).toBeDefined();
        expect(controller.state.base.activePromo).toBe(promo);

        await waitForNextTick(clearActiveTimeout);

        expect(controller.state.base.activePromo).toBe(null);
    });

    it('cancel and not save time', async () => {
        controller.cancelPromo(promo, false, clearActiveTimeout);

        expect(
            controller.state.progress?.progressInfoByType[promoType]?.lastCallTime,
        ).toBeUndefined();
        expect(controller.state.progress?.progressInfoByPromo[promo]?.lastCallTime).toBeUndefined();
        expect(controller.state.base.activePromo).toBe(promo);

        await waitForNextTick(clearActiveTimeout);

        expect(controller.state.base.activePromo).toBe(null);
    });
});

describe('meta info', () => {
    let controller: Controller;
    const promo = 'boardPoll';

    beforeEach(async () => {
        controller = new Controller(testOptions);
        controller.requestStart(promo);

        await waitForNextTick();
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
