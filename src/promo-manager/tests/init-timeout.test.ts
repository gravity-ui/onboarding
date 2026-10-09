import {Controller} from '../core/controller';

import {testOptions} from './options';
import {PromoGroup} from '../core/types';

const INIT_TIMEOUT = 1000;

const pollGroup: PromoGroup = {
    slug: 'poll',
    conditions: [],
    promos: [
        {slug: 'promo1', conditions: []},
        {slug: 'promo2', conditions: []},
    ],
};

const createController = (promoGroups: PromoGroup[] = [pollGroup], options = {}) =>
    new Controller({
        ...testOptions,
        config: {
            promoGroups,
            init: {initType: 'timeout', timeout: INIT_TIMEOUT},
        },
        ...options,
    });

describe('init by timeout races', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('promo requested before init -> activated after timeout, init emitted once', async () => {
        vi.useFakeTimers();
        const controller = createController();

        const initListener = vi.fn();
        controller.events.subscribe('init', initListener);

        const request = controller.requestStart('promo1');

        expect(controller.state.base.activePromo).toBe(null);

        vi.advanceTimersByTime(INIT_TIMEOUT);
        vi.useRealTimers();

        await request;

        expect(controller.state.base.activePromo).toBe('promo1');
        expect(initListener).toHaveBeenCalledTimes(1);
    });

    it('2 requests of same promo before init -> init emitted once', async () => {
        vi.useFakeTimers();
        const controller = createController();

        const initListener = vi.fn();
        controller.events.subscribe('init', initListener);

        const request1 = controller.requestStart('promo1');
        const request2 = controller.requestStart('promo1');

        vi.advanceTimersByTime(INIT_TIMEOUT);
        vi.useRealTimers();

        const results = await Promise.all([request1, request2]);

        expect(results).toEqual([true, true]);
        expect(controller.state.base.activePromo).toBe('promo1');
        expect(initListener).toHaveBeenCalledTimes(1);
    });

    it('2 different promos before init -> only first activates, init emitted once', async () => {
        vi.useFakeTimers();
        const controller = createController();

        const initListener = vi.fn();
        controller.events.subscribe('init', initListener);

        const request1 = controller.requestStart('promo1');
        const request2 = controller.requestStart('promo2');

        vi.advanceTimersByTime(INIT_TIMEOUT);
        vi.useRealTimers();

        await Promise.all([request1, request2]);

        expect(controller.state.base.activePromo).toBe('promo1');
        expect(controller.state.base.activeQueue).toEqual(['promo2']);
        expect(initListener).toHaveBeenCalledTimes(1);
    });

    it('promo condition broken between enqueue and init -> error logged, no unhandled rejection', async () => {
        vi.useFakeTimers();

        let broken = false;
        const brokenConditionGroup: PromoGroup = {
            slug: 'poll',
            conditions: [],
            promos: [
                {
                    slug: 'promo1',
                    conditions: [
                        () => {
                            if (broken) {
                                throw new Error('broken condition');
                            }
                            return true;
                        },
                    ],
                },
            ],
        };

        const errorSpy = vi.fn();
        const controller = createController([brokenConditionGroup], {
            logger: {level: 'error', logger: {debug: () => {}, error: errorSpy}},
        });

        const initListener = vi.fn();
        controller.events.subscribe('init', initListener);

        const request = controller.requestStart('promo1');
        expect(controller.state.base.activeQueue).toEqual(['promo1']);

        broken = true;

        vi.advanceTimersByTime(INIT_TIMEOUT);
        vi.useRealTimers();

        await expect(request).rejects.toThrow('broken condition');

        expect(initListener).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalled();
        expect(controller.state.base.activePromo).toBe(null);
    });
});
