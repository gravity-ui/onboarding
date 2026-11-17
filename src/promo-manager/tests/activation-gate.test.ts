import {Controller} from '../core/controller';
import type {PromoOptions} from '../core/types';
import {PromoTabSyncPlugin} from '../plugins/promo-tab-sync-plugin';
import {testOptions} from './options';

const INIT_EVENT = 'app:ready';

function makeEventGatedController(overrides: Partial<PromoOptions> = {}) {
    const opts: PromoOptions = {
        ...testOptions,
        config: {
            ...testOptions.config,
            init: {initType: 'event', timeout: 3000, event: INIT_EVENT},
        },
        ...overrides,
    } as PromoOptions;
    return new Controller(opts);
}

/** Open the gate the way a real consumer would. */
const openGate = (controller: Controller) => controller.sendEvent(INIT_EVENT);

describe('activation gate (initType: event)', () => {
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
        const controller = makeEventGatedController();
        const settled = vi.fn();
        const ordinary = controller.requestStart('boardPoll').then(settled);
        const highPriority = controller.requestStart('hightPoll2').then(settled);

        await vi.advanceTimersByTimeAsync(0);

        expect(controller.getActivePromo()).toBe(null);
        expect(controller.state.base.activeQueue).toEqual(['hightPoll2', 'boardPoll']);
        expect(settled).not.toHaveBeenCalled();

        await openGate(controller);
        await Promise.all([ordinary, highPriority]);

        expect(controller.getActivePromo()).toBe('hightPoll2');
        expect(controller.state.base.activeQueue).toEqual(['boardPoll']);
        // boardPoll resolved first (registered first), gets false; hightPoll2 gets true.
        expect(settled.mock.calls).toEqual([[false], [true]]);
        expect(controller.state.progress).toEqual(testOptions.progressState);

        controller.finishPromo('hightPoll2');
        expect(controller.getActivePromo()).toBe('boardPoll');
    });

    it('queues all promos from an event while gated and resumes by priority after the gate opens', async () => {
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
                init: {initType: 'event', timeout: 3000, event: INIT_EVENT},
            },
        });

        await openGate(controller);
        await vi.advanceTimersByTimeAsync(0);
        await controller.requestStart('active');

        // Re-arm the gate so subsequent requests queue.
        controller.reinitialize();

        const event = controller.sendEvent('pageOpened');
        await vi.advanceTimersByTimeAsync(0);

        expect(controller.state.base.activeQueue).toEqual(['high', 'ordinary']);
        controller.finishPromo('active');
        expect(controller.getActivePromo()).toBe(null);

        await openGate(controller);
        await event;

        expect(controller.getActivePromo()).toBe('high');
        expect(controller.state.base.activeQueue).toEqual(['ordinary']);
    });

    it('starts event timers while gated without waiting for delayed promos', async () => {
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
                init: {initType: 'event', timeout: 5000, event: INIT_EVENT},
            },
        });

        const event = controller.sendEvent('pageOpened');
        await vi.advanceTimersByTimeAsync(500);

        await openGate(controller);
        await event;
        expect(controller.getActivePromo()).toBe('immediate');
        expect(controller.state.base.activeQueue).toEqual([]);

        // Re-arm.
        controller.reinitialize();
        controller.finishPromo('immediate');

        await vi.advanceTimersByTimeAsync(500);

        expect(controller.getActivePromo()).toBe(null);
        expect(controller.state.base.activeQueue).toEqual(['delayed']);

        await openGate(controller);
        await vi.advanceTimersByTimeAsync(0);
        expect(controller.getActivePromo()).toBe('delayed');
    });

    it('wakes all requests when an init event subscriber throws', async () => {
        const controller = makeEventGatedController();
        const requests = [
            controller.requestStart('boardPoll'),
            controller.requestStart('ganttPoll'),
        ];
        await vi.advanceTimersByTimeAsync(0);

        const unsubscribe = controller.subscribe(() => {
            throw new Error('Subscriber failed');
        });

        // inside the background init IIFE, but the outer promise still resolves.
        await openGate(controller);
        // Let the background work run.
        await vi.advanceTimersByTimeAsync(0);
        unsubscribe();

        await expect(Promise.all(requests)).resolves.toEqual([true, false]);
        expect(controller.getActivePromo()).toBe('boardPoll');
        expect(controller.state.base.activeQueue).toEqual(['ganttPoll']);
    });

    it('does not bypass the event gate when the init event is sent before the timeout', async () => {
        const controller = makeEventGatedController();
        const request = controller.requestStart('boardPoll');

        await vi.advanceTimersByTimeAsync(0);
        expect(controller.getActivePromo()).toBe(null);

        await openGate(controller);
        expect(await request).toBe(true);
        expect(controller.getActivePromo()).toBe('boardPoll');
    });

    it('activates via timeout fallback when the init event never arrives', async () => {
        const controller = makeEventGatedController();
        const request = controller.requestStart('boardPoll');

        await vi.advanceTimersByTimeAsync(2999);
        expect(controller.getActivePromo()).toBe(null);

        await vi.advanceTimersByTimeAsync(1);
        expect(await request).toBe(true);
        expect(controller.getActivePromo()).toBe('boardPoll');
    });

    it.each(['skipPromo', 'finishPromo', 'cancelPromo'] as const)(
        '%s resolves all invalidated requests when the init event arrives',
        async (action) => {
            const controller = makeEventGatedController();
            const settled = vi.fn();
            const requests = [
                controller.requestStart('boardPoll').then(settled),
                controller.requestStart('boardPoll').then(settled),
            ];
            await vi.advanceTimersByTimeAsync(0);
            expect(settled).not.toHaveBeenCalled();

            // Invalidate; callers remain parked until the gate opens
            // (there is no parking loop anymore).
            controller[action]('boardPoll');
            await vi.advanceTimersByTimeAsync(0);
            expect(settled).not.toHaveBeenCalled();

            // The init event opens the gate; version-bumped requests return false.
            await openGate(controller);
            await Promise.all(requests);

            expect(settled.mock.calls).toEqual([[false], [false]]);
            expect(controller.state.base.activeQueue).toEqual([]);
            expect(controller.getActivePromo()).toBe(null);

            if (action === 'skipPromo') {
                expect(controller.state.progress).toEqual(testOptions.progressState);
            } else {
                expect(controller.getPromoStatus('boardPoll')).toBe('finished');
            }
        },
    );

    it('does not let a skipped waiter revive or cancel a retry of the same slug', async () => {
        const controller = makeEventGatedController();
        const originalSettled = vi.fn();
        const original = controller.requestStart('boardPoll').then(originalSettled);
        await vi.advanceTimersByTimeAsync(0);

        controller.skipPromo('boardPoll');
        const retrySettled = vi.fn();
        const retry = controller.requestStart('boardPoll').then(retrySettled);
        await vi.advanceTimersByTimeAsync(0);

        // Both callers still parked — the init event is what wakes them.
        expect(originalSettled).not.toHaveBeenCalled();
        expect(retrySettled).not.toHaveBeenCalled();
        expect(controller.state.base.activeQueue).toEqual(['boardPoll']);

        await openGate(controller);
        await Promise.all([original, retry]);

        // The original request had its version bumped by skipPromo → returns false.
        expect(originalSettled).toHaveBeenCalledExactlyOnceWith(false);
        // The retry request holds the new version → activates normally → returns true.
        expect(retrySettled).toHaveBeenCalledExactlyOnceWith(true);
        expect(controller.getActivePromo()).toBe('boardPoll');
        expect(controller.state.progress).toEqual(testOptions.progressState);
    });

    it('wakes requests invalidated by tab sync', async () => {
        const plugin = new PromoTabSyncPlugin({
            stateLSKey: 'activation-gate-progress',
            __UNSTABLE__syncState: true,
        });
        const controller = new Controller({
            ...testOptions,
            config: {
                ...testOptions.config,
                init: {initType: 'event', timeout: 3000, event: INIT_EVENT},
            },
            plugins: [plugin],
        });
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

        // Version bumped by tab-sync, but caller still parked — the gate opens it.
        expect(finishedElsewhere).not.toHaveBeenCalled();

        await openGate(controller);
        await removed;

        expect(finishedElsewhere).toHaveBeenCalledExactlyOnceWith(false);
        expect(controller.getActivePromo()).toBe(null);
        expect(controller.state.base.activeQueue).toEqual([]);
    });

    it('reinitialize() re-queues surviving promos; active promo is dropped', async () => {
        const controller = makeEventGatedController();
        await openGate(controller);
        await vi.advanceTimersByTimeAsync(0);
        await controller.requestStart('boardPoll');
        await controller.requestStart('ganttPoll');

        expect(controller.getActivePromo()).toBe('boardPoll');
        // boardPoll is active; isAbleToRun returns false for 'active' status,
        // so only ganttPoll (still pending) survives the re-queue.
        controller.reinitialize();
        expect(controller.getActivePromo()).toBe(null);
        expect(controller.state.base.activeQueue).toEqual(['ganttPoll']);

        await openGate(controller);
        await vi.advanceTimersByTimeAsync(0);
        expect(controller.getActivePromo()).toBe('ganttPoll');
    });

    it('callers parked across reinitialize() resolve rather than hang or throw', async () => {
        const controller = makeEventGatedController();
        const settled = vi.fn();
        const parked = controller.requestStart('boardPoll').then(settled);
        await vi.advanceTimersByTimeAsync(0);

        // Re-arm before the gate first opens.
        controller.reinitialize();
        await vi.advanceTimersByTimeAsync(0);

        // parked caller woke and saw status='idle' → resolved false.
        expect(settled).toHaveBeenCalledExactlyOnceWith(false);
        // The promo is still queued; opening the gate activates it.
        expect(controller.state.base.activeQueue).toEqual(['boardPoll']);

        await openGate(controller);
        await vi.advanceTimersByTimeAsync(0);
        expect(controller.getActivePromo()).toBe('boardPoll');

        await parked;
    });

    it('repeated reinitialize() calls do not hang callers', async () => {
        const controller = makeEventGatedController();
        const req1 = controller.requestStart('boardPoll');
        await vi.advanceTimersByTimeAsync(0);

        controller.reinitialize();
        await vi.advanceTimersByTimeAsync(0);
        expect(await req1).toBe(false);

        const req2 = controller.requestStart('boardPoll');
        await vi.advanceTimersByTimeAsync(0);
        controller.reinitialize();
        await vi.advanceTimersByTimeAsync(0);
        expect(await req2).toBe(false);

        const req3 = controller.requestStart('boardPoll');
        await openGate(controller);
        expect(await req3).toBe(true);
        expect(controller.getActivePromo()).toBe('boardPoll');
    });

    it('init event name independent from promo triggers: gate opens and promos fire together', async () => {
        const controller = new Controller({
            ...testOptions,
            config: {
                promoGroups: [
                    {
                        slug: 'eventPromos',
                        promos: [{slug: 'onReadyPromo', trigger: {on: INIT_EVENT}}],
                    },
                ],
                init: {initType: 'event', timeout: 3000, event: INIT_EVENT},
            },
        });

        const request = controller.requestStart('onReadyPromo');
        await vi.advanceTimersByTimeAsync(0);

        await openGate(controller);
        expect(await request).toBe(true);
        expect(controller.getActivePromo()).toBe('onReadyPromo');
    });
});
