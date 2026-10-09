import {Controller as OnboardingController} from '../../controller';
import {act, render} from '@testing-library/react';
import {createElement} from 'react';
import {getAnchorElement, getOptionsWithPromo} from '../../tests/utils';
import {Controller} from '../core/controller';
import {PromoWrapper, createPromoManager} from '../core';
import type {PromoProgressState} from '../core/types';
import {testOptions} from './options';

describe('timeout initialization races', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => {
        vi.useRealTimers();
        document.body.replaceChildren();
    });

    it('emits init once when requests arrive before the timeout', async () => {
        const controller = new Controller({
            ...testOptions,
            config: {...testOptions.config, init: {initType: 'timeout', timeout: 3000}},
        });
        const initialized = vi.fn();
        controller.events.subscribe('init', initialized);

        const requests = [
            controller.requestStart('boardPoll'),
            controller.requestStart('boardPoll'),
        ];
        await vi.advanceTimersByTimeAsync(3000);
        await Promise.all(requests);

        expect(controller.getActivePromo()).toBe('boardPoll');
        expect(initialized).toHaveBeenCalledTimes(1);
    });

    it('shows the remaining promo when the first anchor disappears before timeout', async () => {
        const onboarding = new OnboardingController(
            getOptionsWithPromo({
                wizardState: 'hidden',
                activePresets: ['coolNewFeature', 'coolNewFeature2'],
            }),
        );
        const controller = new Controller({
            ...testOptions,
            config: {
                promoGroups: [{slug: 'hints', promos: []}],
                init: {initType: 'timeout', timeout: 3000},
            },
            onboarding: {getInstance: () => onboarding, groupSlug: 'hints'},
        });
        const firstElement = getAnchorElement();
        const first = onboarding.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: firstElement,
        });
        const second = onboarding.stepElementReached({
            stepSlug: 'showCoolFeature2',
            element: getAnchorElement(),
        });
        await vi.advanceTimersByTimeAsync(0);
        expect(controller.state.base.activeQueue).toEqual(['coolNewFeature', 'coolNewFeature2']);

        firstElement.remove();
        onboarding.stepElementDisappeared('showCoolFeature');
        await vi.advanceTimersByTimeAsync(3000);
        await Promise.all([first, second]);

        expect(controller.getActivePromo()).toBe('coolNewFeature2');
        expect(onboarding.hintStore.state.open).toBe(true);
        expect(onboarding.hintStore.state.hint?.step.slug).toBe('showCoolFeature2');
    });

    it.each([1000, 4000])(
        'does not revive a skipped request when progress arrives at %i ms',
        async (progressDelay) => {
            let resolveProgress!: (progress: Partial<PromoProgressState>) => void;
            const progress = new Promise<Partial<PromoProgressState>>((resolve) => {
                resolveProgress = resolve;
            });
            const controller = new Controller({
                ...testOptions,
                progressState: undefined,
                getProgressState: () => progress,
                config: {...testOptions.config, init: {initType: 'timeout', timeout: 3000}},
            });
            const request = controller.requestStart('boardPoll');
            controller.skipPromo('boardPoll');

            await vi.advanceTimersByTimeAsync(progressDelay);
            resolveProgress({});
            await vi.advanceTimersByTimeAsync(3000);
            const result = await request;

            expect.soft(controller.getActivePromo()).toBe(null);
            expect(result).toBe(false);
            expect(controller.state.base.activeQueue).toEqual([]);
        },
    );

    it('unmounts PromoWrapper safely while progress is loading', async () => {
        let resolveProgress!: (progress: Partial<PromoProgressState>) => void;
        const progress = new Promise<Partial<PromoProgressState>>((resolve) => {
            resolveProgress = resolve;
        });
        const {controller} = createPromoManager({
            ...testOptions,
            progressState: undefined,
            getProgressState: () => progress,
            config: {...testOptions.config, init: {initType: 'timeout', timeout: 3000}},
        });
        const view = render(
            createElement(PromoWrapper, {showOnPromo: 'boardPoll', children: 'Promo'}),
        );
        let unmountError: unknown;
        try {
            view.unmount();
        } catch (error) {
            unmountError = error;
        }
        await act(async () => {
            resolveProgress({});
            await vi.advanceTimersByTimeAsync(3000);
        });

        expect.soft(unmountError).toBeUndefined();
        expect(controller.getActivePromo()).toBe(null);
    });

    it('honors skip when progress is already loaded before timeout', async () => {
        const controller = new Controller({
            ...testOptions,
            config: {...testOptions.config, init: {initType: 'timeout', timeout: 3000}},
        });
        const request = controller.requestStart('boardPoll');
        controller.skipPromo('boardPoll');
        await vi.advanceTimersByTimeAsync(3000);

        expect(await request).toBe(false);
        expect(controller.getActivePromo()).toBe(null);
    });

    it('allows a new start after skip without reviving the old queued request', async () => {
        const controller = new Controller({
            ...testOptions,
            config: {...testOptions.config, init: {initType: 'timeout', timeout: 3000}},
        });
        const skipped = controller.requestStart('boardPoll');
        controller.skipPromo('boardPoll');
        const retry = controller.requestStart('boardPoll');
        await vi.advanceTimersByTimeAsync(3000);

        expect(await skipped).toBe(false);
        expect(await retry).toBe(true);
        expect(controller.getActivePromo()).toBe('boardPoll');
        expect(controller.state.progress?.finishedPromos).toEqual([]);
        expect(controller.state.progress?.progressInfoByPromo).toEqual({});
    });

    it('skips all starts waiting for progress and allows a new request', async () => {
        let resolveProgress!: (progress: Partial<PromoProgressState>) => void;
        const progress = new Promise<Partial<PromoProgressState>>((resolve) => {
            resolveProgress = resolve;
        });
        const controller = new Controller({
            ...testOptions,
            progressState: undefined,
            getProgressState: () => progress,
            config: {...testOptions.config, init: {initType: 'timeout', timeout: 3000}},
        });
        const skipped = [
            controller.requestStart('boardPoll'),
            controller.requestStart('boardPoll'),
        ];
        controller.skipPromo('boardPoll');
        const retry = controller.requestStart('boardPoll');
        resolveProgress({});
        await vi.advanceTimersByTimeAsync(3000);

        expect(await Promise.all(skipped)).toEqual([false, false]);
        expect(await retry).toBe(true);
        expect(controller.getActivePromo()).toBe('boardPoll');
    });

    it.each(['finishPromo', 'cancelPromo'] as const)(
        '%s before progress loads prevents activation and saves progress',
        async (action) => {
            let resolveProgress!: (progress: Partial<PromoProgressState>) => void;
            const progress = new Promise<Partial<PromoProgressState>>((resolve) => {
                resolveProgress = resolve;
            });
            const save = vi.fn(async () => {});
            const controller = new Controller({
                ...testOptions,
                progressState: undefined,
                getProgressState: () => progress,
                onSave: {progress: save},
                config: {...testOptions.config, init: {initType: 'timeout', timeout: 3000}},
            });
            const event = vi.fn();
            controller.events.subscribe(action, event);
            const request = controller.requestStart('boardPoll');
            expect(() => controller[action]('boardPoll')).not.toThrow();
            resolveProgress({});
            await vi.advanceTimersByTimeAsync(3000);

            expect(await request).toBe(false);
            expect(controller.getActivePromo()).toBe(null);
            expect(controller.state.base.activeQueue).toEqual([]);
            expect(controller.getPromoStatus('boardPoll')).toBe('finished');
            expect(event).toHaveBeenCalledOnce();
            expect(save).toHaveBeenCalledExactlyOnceWith(controller.state.progress);
            if (action === 'finishPromo') {
                expect(controller.state.progress?.finishedPromos).toEqual(['boardPoll']);
            }
        },
    );

    it('logs progress loading failures during deferred cancellation', async () => {
        let rejectProgress!: (error: Error) => void;
        const progress = new Promise<Partial<PromoProgressState>>((_, reject) => {
            rejectProgress = reject;
        });
        const error = vi.fn();
        const save = vi.fn(async () => {});
        const controller = new Controller({
            ...testOptions,
            progressState: undefined,
            getProgressState: () => progress,
            onSave: {progress: save},
            logger: {level: 'error', logger: {debug: vi.fn(), error}},
            config: {...testOptions.config, init: {initType: 'timeout', timeout: 3000}},
        });
        expect(() => controller.cancelPromo('boardPoll')).not.toThrow();
        rejectProgress(new Error('load failed'));
        await vi.advanceTimersByTimeAsync(3000);

        expect(error).toHaveBeenCalledWith(new Error('Progress data loading error'));
        expect(controller.getActivePromo()).toBe(null);
        expect(save).not.toHaveBeenCalled();
    });

    it('does not let an obsolete hint request skip a new attempt', async () => {
        const onboarding = new OnboardingController(getOptionsWithPromo({wizardState: 'hidden'}));
        const controller = new Controller({
            ...testOptions,
            config: {
                promoGroups: [{slug: 'hints', promos: []}],
                init: {initType: 'timeout', timeout: 3000},
            },
            onboarding: {getInstance: () => onboarding, groupSlug: 'hints'},
        });
        const originalElement = getAnchorElement();
        const original = onboarding.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: originalElement,
        });
        await vi.advanceTimersByTimeAsync(0);
        expect(controller.state.base.activeQueue).toEqual(['coolNewFeature']);
        controller.skipPromo('coolNewFeature');
        originalElement.remove();
        onboarding.stepElementDisappeared('showCoolFeature');
        const replacement = getAnchorElement();
        const retry = onboarding.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: replacement,
        });
        await vi.advanceTimersByTimeAsync(3000);
        await Promise.all([original, retry]);

        expect(controller.getActivePromo()).toBe('coolNewFeature');
        expect(onboarding.hintStore.state.open).toBe(true);
        expect(onboarding.hintStore.state.anchorRef.current).toBe(replacement);
    });

    it('logs automatic initialization failures without an unhandled rejection', async () => {
        const error = vi.fn();
        const condition = vi.fn(() => true);
        const controller = new Controller({
            ...testOptions,
            logger: {level: 'error', logger: {debug: vi.fn(), error}},
            config: {
                promoGroups: [{slug: 'polls', promos: [{slug: 'poll', conditions: [condition]}]}],
                init: {initType: 'timeout', timeout: 3000},
            },
        });
        const request = controller.requestStart('poll');
        const failure = new Error('activation failed');
        condition.mockImplementation(() => {
            throw failure;
        });
        const outcome = expect(request).rejects.toThrow(failure);
        await vi.advanceTimersByTimeAsync(3000);
        await outcome;

        expect(error).toHaveBeenCalledExactlyOnceWith(failure);
        expect(controller.getActivePromo()).toBe(null);
    });

    it('returns false if a subscriber skips and restarts the promo during activation', async () => {
        const controller = new Controller({
            ...testOptions,
            config: {...testOptions.config, init: {initType: 'timeout', timeout: 3000}},
        });
        await vi.advanceTimersByTimeAsync(3000);
        let retried = false;
        let retry: Promise<boolean> | undefined;
        controller.subscribe(() => {
            if (retried || controller.getActivePromo() !== 'boardPoll') {
                return;
            }
            retried = true;
            controller.skipPromo('boardPoll');
            retry = controller.requestStart('boardPoll');
            controller.finishPromo('ganttPoll');
        });
        const original = controller.requestStart('boardPoll');
        const next = controller.requestStart('ganttPoll');
        await next;

        expect(await original).toBe(false);
        expect(await retry).toBe(true);
        expect(controller.getActivePromo()).toBe('boardPoll');
    });
});
