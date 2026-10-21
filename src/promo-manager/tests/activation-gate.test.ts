import {Controller} from '../core/controller';
import {PromoTabSyncPlugin} from '../plugins/promo-tab-sync-plugin';
import {testOptions} from './options';

describe('activation gate', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        localStorage.clear();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        localStorage.clear();
    });

    it('keeps requests pending after initialization and resumes in configured priority order', async () => {
        const controller = new Controller({
            ...testOptions,
            config: {...testOptions.config, init: {initType: 'timeout', timeout: 3000}},
        });
        controller.pauseActivation();
        const settled = vi.fn();
        const ordinary = controller.requestStart('boardPoll').then(settled);
        const highPriority = controller.requestStart('hightPoll2').then(settled);

        await vi.advanceTimersByTimeAsync(3000);
        await controller.ensureInit();

        expect(controller.getActivePromo()).toBe(null);
        expect(controller.state.base.activeQueue).toEqual(['hightPoll2', 'boardPoll']);
        expect(settled).not.toHaveBeenCalled();

        controller.resumeActivation();
        await Promise.all([ordinary, highPriority]);

        expect(controller.getActivePromo()).toBe('hightPoll2');
        expect(controller.state.base.activeQueue).toEqual(['boardPoll']);
        expect(settled.mock.calls).toEqual([[false], [true]]);
        expect(controller.state.progress).toEqual(testOptions.progressState);

        controller.finishPromo('hightPoll2');
        expect(controller.getActivePromo()).toBe('boardPoll');
    });

    it('queues all promos from an event while paused and resumes by priority', async () => {
        const controller = new Controller({
            ...testOptions,
            config: {
                promoGroups: [
                    {
                        slug: 'eventPromos',
                        promos: [
                            {slug: 'active'},
                            {slug: 'ordinary', trigger: {on: 'pageOpened'}},
                            {slug: 'high', priority: 'high', trigger: {on: 'pageOpened'}},
                        ],
                    },
                ],
            },
        });
        await vi.advanceTimersByTimeAsync(0);
        await controller.requestStart('active');
        controller.pauseActivation();

        const event = controller.sendEvent('pageOpened');
        await vi.advanceTimersByTimeAsync(0);

        expect(controller.state.base.activeQueue).toEqual(['high', 'ordinary']);
        controller.finishPromo('active');
        expect(controller.getActivePromo()).toBe(null);

        controller.resumeActivation();
        await event;

        expect(controller.getActivePromo()).toBe('high');
        expect(controller.state.base.activeQueue).toEqual(['ordinary']);
    });

    it('starts event timers while paused without waiting for delayed promos', async () => {
        const controller = new Controller({
            ...testOptions,
            config: {
                promoGroups: [
                    {
                        slug: 'eventPromos',
                        promos: [
                            {slug: 'immediate', trigger: {on: 'pageOpened'}},
                            {slug: 'delayed', trigger: {on: 'pageOpened', timeout: 1000}},
                        ],
                    },
                ],
            },
        });
        controller.pauseActivation();
        const event = controller.sendEvent('pageOpened');
        await vi.advanceTimersByTimeAsync(500);

        controller.resumeActivation();
        await event;
        expect(controller.getActivePromo()).toBe('immediate');
        expect(controller.state.base.activeQueue).toEqual([]);

        controller.pauseActivation();
        controller.finishPromo('immediate');
        await vi.advanceTimersByTimeAsync(500);

        expect(controller.getActivePromo()).toBe(null);
        expect(controller.state.base.activeQueue).toEqual(['delayed']);
        controller.resumeActivation();
        expect(controller.getActivePromo()).toBe('delayed');
    });

    it('wakes all requests when an activation subscriber throws', async () => {
        const controller = new Controller(testOptions);
        controller.pauseActivation();
        const requests = [
            controller.requestStart('boardPoll'),
            controller.requestStart('ganttPoll'),
        ];
        await vi.advanceTimersByTimeAsync(0);
        const unsubscribe = controller.subscribe(() => {
            throw new Error('Subscriber failed');
        });

        expect(() => controller.resumeActivation()).toThrow('Subscriber failed');
        unsubscribe();

        await expect(Promise.all(requests)).resolves.toEqual([true, false]);
        expect(controller.getActivePromo()).toBe('boardPoll');
        expect(controller.state.base.activeQueue).toEqual(['ganttPoll']);
    });

    it('does not bypass initialization when resumed before its timeout', async () => {
        const controller = new Controller({
            ...testOptions,
            config: {...testOptions.config, init: {initType: 'timeout', timeout: 3000}},
        });
        controller.pauseActivation();
        const request = controller.requestStart('boardPoll');
        controller.resumeActivation();

        await vi.advanceTimersByTimeAsync(2999);
        expect(controller.getActivePromo()).toBe(null);

        await vi.advanceTimersByTimeAsync(1);
        expect(await request).toBe(true);
        expect(controller.getActivePromo()).toBe('boardPoll');
    });

    it.each(['skipPromo', 'finishPromo', 'cancelPromo'] as const)(
        '%s resolves all invalidated requests without waiting for resume',
        async (action) => {
            const controller = new Controller(testOptions);
            controller.pauseActivation();
            const settled = vi.fn();
            const requests = [
                controller.requestStart('boardPoll').then(settled),
                controller.requestStart('boardPoll').then(settled),
            ];
            await vi.advanceTimersByTimeAsync(0);
            expect(settled).not.toHaveBeenCalled();

            controller[action]('boardPoll');
            await vi.advanceTimersByTimeAsync(0);

            expect(settled.mock.calls).toEqual([[false], [false]]);
            expect(controller.state.base.activeQueue).toEqual([]);
            expect(controller.getActivePromo()).toBe(null);
            await Promise.all(requests);

            controller.resumeActivation();
            expect(controller.getActivePromo()).toBe(null);
            if (action === 'skipPromo') {
                expect(controller.state.progress).toEqual(testOptions.progressState);
            } else {
                expect(controller.getPromoStatus('boardPoll')).toBe('finished');
            }
        },
    );

    it('does not let a skipped waiter revive or cancel a retry of the same slug', async () => {
        const controller = new Controller(testOptions);
        controller.pauseActivation();
        const originalSettled = vi.fn();
        const original = controller.requestStart('boardPoll').then(originalSettled);
        await vi.advanceTimersByTimeAsync(0);

        controller.skipPromo('boardPoll');
        const retrySettled = vi.fn();
        const retry = controller.requestStart('boardPoll').then(retrySettled);
        await vi.advanceTimersByTimeAsync(0);

        expect(originalSettled).toHaveBeenCalledExactlyOnceWith(false);
        expect(retrySettled).not.toHaveBeenCalled();
        expect(controller.state.base.activeQueue).toEqual(['boardPoll']);

        controller.resumeActivation();
        await Promise.all([original, retry]);

        expect(retrySettled).toHaveBeenCalledExactlyOnceWith(true);
        expect(controller.getActivePromo()).toBe('boardPoll');
        expect(controller.state.progress).toEqual(testOptions.progressState);
    });

    it('keeps surviving requests waiting when activation is paused again before waiters resume', async () => {
        const controller = new Controller(testOptions);
        controller.pauseActivation();
        const first = controller.requestStart('boardPoll');
        const remainingSettled = vi.fn();
        const remaining = controller.requestStart('ganttPoll').then(remainingSettled);
        await vi.advanceTimersByTimeAsync(0);

        controller.resumeActivation();
        controller.pauseActivation();
        controller.skipPromo('boardPoll');
        await vi.advanceTimersByTimeAsync(0);

        expect(await first).toBe(false);
        expect(remainingSettled).not.toHaveBeenCalled();
        expect(controller.getActivePromo()).toBe(null);
        expect(controller.state.base.activeQueue).toEqual(['ganttPoll']);

        controller.resumeActivation();
        await remaining;
        expect(remainingSettled).toHaveBeenCalledExactlyOnceWith(true);
        expect(controller.getActivePromo()).toBe('ganttPoll');
    });

    it('wakes requests invalidated by tab sync', async () => {
        const plugin = new PromoTabSyncPlugin({
            stateLSKey: 'activation-gate-progress',
            __UNSTABLE__syncState: true,
        });
        const controller = new Controller({...testOptions, plugins: [plugin]});
        controller.pauseActivation();
        const finishedElsewhere = vi.fn();
        const removed = controller.requestStart('boardPoll').then(finishedElsewhere);
        await vi.advanceTimersByTimeAsync(0);

        localStorage.setItem(
            plugin.options.stateLSKey,
            JSON.stringify({
                date: controller.dateNow() + 1,
                value: {finishedPromos: ['boardPoll'], progressInfoByPromo: {}},
            }),
        );
        document.dispatchEvent(new Event('visibilitychange'));
        await vi.advanceTimersByTimeAsync(0);

        expect(finishedElsewhere).toHaveBeenCalledExactlyOnceWith(false);
        expect(controller.getActivePromo()).toBe(null);
        expect(controller.state.base.activeQueue).toEqual([]);

        controller.resumeActivation();
        await removed;
        expect(controller.getActivePromo()).toBe(null);
    });

    it('preserves an active promo and waits for resume after it finishes', async () => {
        const controller = new Controller(testOptions);
        await vi.advanceTimersByTimeAsync(0);
        await controller.requestStart('boardPoll');
        await controller.requestStart('ganttPoll');

        controller.pauseActivation();
        expect(controller.getActivePromo()).toBe('boardPoll');

        controller.finishPromo('boardPoll');
        expect(controller.getActivePromo()).toBe(null);
        expect(controller.state.base.activeQueue).toEqual(['ganttPoll']);

        controller.resumeActivation();
        expect(controller.getActivePromo()).toBe('ganttPoll');
    });
});
