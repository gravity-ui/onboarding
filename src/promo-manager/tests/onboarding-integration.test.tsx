import {Controller as OnboardingController} from '../../controller';
import {createPreset} from '../../index';
import {getHintTransitions} from '../../internal/hint-transitions';
import {MultiTabSyncPlugin} from '../../plugins/multi-tab-sync';
import type {InitOptions, ProgressState} from '../../types';
import {Controller} from '../core/controller';
import {testOptions} from './options';
import {getAnchorElement, getOptionsWithPromo} from '../../tests/utils';
import {waitForNextTick} from './utils';

const getData = () => {
    const onboardingController = new OnboardingController(
        getOptionsWithPromo({wizardState: 'hidden'}),
    );
    const options = {
        ...testOptions,
        config: {
            promoGroups: [
                {
                    slug: 'hintPromos',
                    conditions: [],
                    promos: [],
                },
            ],
        },
        onboarding: {
            getInstance: () => onboardingController,
            groupSlug: 'hintPromos',
        },
    };

    return {
        onboardingController,
        options,
    };
};

const createDeferred = <T = void,>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    const promise = new Promise<T>((resolvePromise) => {
        resolve = resolvePromise;
    });
    return {promise, resolve};
};

const getMultistepData = (hooks?: InitOptions<{}, string, string>['hooks']) => {
    const onboardingOptions = getOptionsWithPromo({wizardState: 'hidden'});
    onboardingOptions.config.presets.coolNewFeature.steps.push({
        slug: 'nextCoolFeature',
        name: '',
        description: '',
    });
    const onboardingController = new OnboardingController({...onboardingOptions, hooks});
    const controller = new Controller({
        ...testOptions,
        config: {
            promoGroups: [
                {slug: 'hintPromos', promos: []},
                {slug: 'polls', promos: [{slug: 'poll'}]},
            ],
        },
        onboarding: {getInstance: () => onboardingController, groupSlug: 'hintPromos'},
    });

    const preset = onboardingController.options.config.presets.coolNewFeature;
    if (preset.type === 'combined') {
        throw new Error('Expected a normal preset');
    }
    const reach = (stepSlug: string, element = getAnchorElement()) =>
        onboardingController.stepElementReached({stepSlug, element});

    return {onboardingController, controller, preset, reach};
};

describe('init', function () {
    it('no group -> error', async function () {
        const onboardingController = new OnboardingController(getOptionsWithPromo());

        const errorLoggerMock = vi.fn();

        const controller = new Controller({
            ...testOptions,
            config: {
                promoGroups: [],
            },
            onboarding: {
                getInstance: () => onboardingController,
                groupSlug: 'hintPromos',
            },
            logger: {
                level: 'error',
                logger: {
                    error: errorLoggerMock,
                    debug: vi.fn(),
                },
            },
        });

        await controller.ensureInit();

        expect(errorLoggerMock).toHaveBeenCalled();
    });

    it('adds promos for every "alwaysHidden" preset', async function () {
        const {options} = getData();
        const controller = new Controller(options);

        await controller.ensureInit();

        const {promos} = controller.options.config.promoGroups[0];

        expect(promos).toEqual([
            {slug: 'coolNewFeature', conditions: []},
            {slug: 'coolNewFeature2', conditions: []},
        ]);
    });

    it('not duplicate existing promos', async function () {
        const onboardingController = new OnboardingController(getOptionsWithPromo());

        const existingPromo = {
            slug: 'coolNewFeature',
            conditions: [],
            meta: {a: 12},
        };
        const controller = new Controller({
            ...testOptions,
            config: {
                promoGroups: [
                    {
                        slug: 'hintPromos',
                        promos: [existingPromo],
                    },
                ],
            },
            onboarding: {
                getInstance: () => onboardingController,
                groupSlug: 'hintPromos',
            },
        });

        await controller.ensureInit();

        const {promos} = controller.options.config.promoGroups[0];

        expect(promos[0]).toBe(existingPromo);
        expect(promos[1]).toEqual({slug: 'coolNewFeature2', conditions: []});
    });
});

describe('show hint', function () {
    it('reach element -> show hint', async function () {
        const onboardingController = new OnboardingController(
            getOptionsWithPromo({wizardState: 'hidden'}),
        );
        const options = {
            ...testOptions,
            config: {
                promoGroups: [
                    {
                        slug: 'hintPromos',
                        conditions: [],
                        promos: [],
                    },
                ],
            },
            onboarding: {
                getInstance: () => onboardingController,
                groupSlug: 'hintPromos',
            },
        };

        const controller = new Controller(options);
        await controller.ensureInit();

        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });

        expect(onboardingController.hintStore.state.open).toBe(true);
        expect(onboardingController.hintStore.state.hint?.step.slug).toBe('showCoolFeature');
    });

    it('2 reach element(race condition) -> show hint', async function () {
        const onboardingController = new OnboardingController(
            getOptionsWithPromo({wizardState: 'hidden'}),
        );
        const options = {
            ...testOptions,
            config: {
                promoGroups: [
                    {
                        slug: 'hintPromos',
                        conditions: [],
                        promos: [],
                    },
                ],
            },
            onboarding: {
                getInstance: () => onboardingController,
                groupSlug: 'hintPromos',
            },
        };

        const controller = new Controller(options);
        await controller.ensureInit();

        const promise1 = onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });
        const promise2 = onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });

        await Promise.all([promise1, promise2]);

        expect(onboardingController.hintStore.state.open).toBe(true);
        expect(onboardingController.hintStore.state.hint?.step.slug).toBe('showCoolFeature');
    });

    it('false in promo condition -> no hint, no activePromo', async function () {
        const onboardingController = new OnboardingController(
            getOptionsWithPromo({wizardState: 'hidden'}),
        );

        const controller = new Controller({
            ...testOptions,
            config: {
                promoGroups: [
                    {
                        slug: 'hintPromos',
                        conditions: [() => false],
                        promos: [],
                    },
                ],
            },
            onboarding: {
                getInstance: () => onboardingController,
                groupSlug: 'hintPromos',
            },
        });

        await controller.ensureInit();

        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });

        expect(onboardingController.hintStore.state.open).toBe(false);
        expect(controller.state.base.activePromo).toBe(null);
    });

    it('return to onboarding promo -> show hint', async function () {
        const {options, onboardingController} = getData();
        const controller = new Controller(options);

        await controller.ensureInit();

        await controller.requestStart('someOtherPromo');
        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });

        await controller.finishPromo('someOtherPromo');

        await waitForNextTick();

        expect(controller.state.base.activePromo).toBe('coolNewFeature');
        expect(onboardingController.hintStore.state.open).toBe(true);
        expect(onboardingController.hintStore.state.hint?.step.slug).toBe('showCoolFeature');
    });

    it('should allow to show common preset', async function () {
        const onboardingController = new OnboardingController(
            getOptionsWithPromo({wizardState: 'visible'}),
        );
        const options = {
            ...testOptions,
            config: {
                promoGroups: [
                    {
                        slug: 'hintPromos',
                        conditions: [],
                        promos: [],
                    },
                ],
            },
            onboarding: {
                getInstance: () => onboardingController,
                groupSlug: 'hintPromos',
            },
        };

        const controller = new Controller(options);
        await controller.ensureInit();

        await onboardingController.stepElementReached({
            stepSlug: 'openBoard',
            element: getAnchorElement(),
        });

        expect(onboardingController.hintStore.state.open).toBe(true);
        expect(onboardingController.hintStore.state.hint?.step.slug).toBe('openBoard');
    });
});

describe('promos behavior', function () {
    it('accepts a beforeShowHint event without an attempt guard', async () => {
        const {onboardingController, controller, reach} = getMultistepData();
        const element = getAnchorElement();
        await controller.ensureInit();
        await reach('showCoolFeature', element);

        await expect(
            onboardingController.events.emit('beforeShowHint', {
                stepData: {preset: 'coolNewFeature', stepSlug: 'showCoolFeature', element},
            }),
        ).resolves.toBe(true);
    });

    it.each([false, true])(
        'keeps a manually acquired hint slot with an earlier automatic attempt: %s',
        async (overlapping) => {
            const {onboardingController, controller, preset, reach} = getMultistepData({
                stepElementReached: () => false,
            });
            const automaticGate = createDeferred<boolean>();
            const manualGate = createDeferred();
            const element = getAnchorElement();
            const event = {
                stepData: {preset: 'coolNewFeature', stepSlug: 'showCoolFeature', element},
            };
            onboardingController.events.subscribe('beforeShowHint', (currentEvent) =>
                currentEvent === event ? manualGate.promise : automaticGate.promise,
            );
            let automatic: Promise<void> | undefined;
            let manual: Promise<boolean> | undefined;

            try {
                await controller.ensureInit();
                await reach('showCoolFeature', element);
                if (overlapping) {
                    automatic = onboardingController.processElementAppearance(event.stepData);
                    await waitForNextTick();
                }
                manual = onboardingController.events.emit('beforeShowHint', event);
                await waitForNextTick();
                automaticGate.resolve(false);
                await automatic;
                await waitForNextTick();

                expect(controller.getActivePromo()).toBe('coolNewFeature');
                await controller.requestStart('poll');
                expect(controller.state.base.activeQueue).toEqual(['poll']);
                manualGate.resolve();
                await expect(manual).resolves.toBe(true);
                onboardingController.hintStore.showHint({
                    preset: 'coolNewFeature',
                    element,
                    step: preset.steps[0],
                });
                await waitForNextTick();

                expect(controller.getActivePromo()).toBe('coolNewFeature');
                expect(onboardingController.hintStore.state.open).toBe(true);
                onboardingController.closeHintByUser();
                await waitForNextTick();
                expect(controller.getActivePromo()).toBe('poll');
            } finally {
                automaticGate.resolve(false);
                manualGate.resolve();
                await automatic;
                await manual;
                await waitForNextTick();
            }
        },
    );

    it('retains the promo slot while a direct appearance call prepares its hint', async () => {
        const {onboardingController, controller, reach} = getMultistepData({
            stepElementReached: () => false,
        });
        const {promise: gate, resolve: release} = createDeferred();
        onboardingController.events.subscribe('beforeShowHint', () => gate);
        const element = getAnchorElement();
        await controller.ensureInit();
        await reach('showCoolFeature', element);

        const appearance = onboardingController.processElementAppearance({
            preset: 'coolNewFeature',
            stepSlug: 'showCoolFeature',
            element,
        });
        try {
            await waitForNextTick();
            expect(controller.getActivePromo()).toBe('coolNewFeature');
            expect(onboardingController.hintStore.state.open).toBe(false);
            await controller.requestStart('poll');
            expect(controller.state.base.activeQueue).toEqual(['poll']);
        } finally {
            release();
            await appearance;
        }

        expect(controller.getActivePromo()).toBe('coolNewFeature');
        expect(onboardingController.hintStore.state.hint?.step.slug).toBe('showCoolFeature');
        onboardingController.closeHintByUser();
        await waitForNextTick();
        expect(controller.getActivePromo()).toBe('poll');
    });

    it('releases a closed hint after its preset finishes in another tab', async () => {
        const {onboardingController, controller, reach} = getMultistepData();
        const sync = new MultiTabSyncPlugin({__unstable_enableStateSync: true});
        sync.apply({onboarding: onboardingController});
        try {
            await controller.ensureInit();
            await reach('showCoolFeature');
            await controller.requestStart('poll');
            expect(controller.getActivePromo()).toBe('coolNewFeature');

            const syncedState = JSON.parse(JSON.stringify(onboardingController.state));
            syncedState.progress.presetPassedSteps.coolNewFeature = [
                'showCoolFeature',
                'nextCoolFeature',
            ];
            syncedState.progress.finishedPresets = ['coolNewFeature'];
            syncedState.base.activePresets = syncedState.base.activePresets.filter(
                (preset: string) => preset !== 'coolNewFeature',
            );
            window.dispatchEvent(
                new StorageEvent('storage', {
                    key: sync.options.changeStateLSKey,
                    newValue: JSON.stringify(syncedState),
                }),
            );
            onboardingController.closeHintByUser();
            await waitForNextTick();

            expect(onboardingController.hintStore.state.open).toBe(false);
            expect(controller.getActivePromo()).toBe('poll');
            expect(controller.state.base.activeQueue).toEqual([]);
        } finally {
            window.removeEventListener('storage', sync.handleLSEvent);
            localStorage.removeItem(sync.options.changeStateLSKey);
            localStorage.removeItem(sync.options.closeHintLSKey);
        }
    });

    it.each([
        {order: 'before', nextAnchor: false, removeFirstAnchor: false},
        {order: 'after', nextAnchor: false, removeFirstAnchor: false},
        {order: 'before', nextAnchor: true, removeFirstAnchor: true},
        {order: 'after', nextAnchor: true, removeFirstAnchor: true},
    ] as const)(
        'settles an obsolete first hint with its hook $order integration, next anchor: $nextAnchor, old anchor removed: $removeFirstAnchor',
        async ({order, nextAnchor, removeFirstAnchor}) => {
            const {promise: firstGate, resolve: releaseFirst} = createDeferred();
            const {promise: secondGate, resolve: releaseSecond} = createDeferred();
            const hook: NonNullable<InitOptions<{}, string, string>['hooks']>['beforeShowHint'] = ({
                stepData,
            }) => (stepData.stepSlug === 'showCoolFeature' ? firstGate : undefined);
            const {onboardingController, controller, reach} = getMultistepData(
                order === 'before' ? {beforeShowHint: hook} : undefined,
            );
            if (order === 'after') {
                onboardingController.events.subscribe('beforeShowHint', hook);
            }
            onboardingController.events.subscribe('beforeShowHint', ({stepData}) =>
                stepData.stepSlug === 'nextCoolFeature' ? secondGate : undefined,
            );
            await controller.ensureInit();
            if (nextAnchor) {
                await reach('nextCoolFeature');
            }
            const firstAnchor = getAnchorElement();
            const appearance = reach('showCoolFeature', firstAnchor);
            await waitForNextTick();
            await onboardingController.passStep('showCoolFeature');
            await waitForNextTick();
            await controller.requestStart('poll');
            if (removeFirstAnchor) {
                firstAnchor.remove();
            }
            releaseFirst();
            await appearance;
            await waitForNextTick();

            expect(onboardingController.hintStore.state.open).toBe(false);
            expect(controller.getActivePromo()).toBe(nextAnchor ? 'coolNewFeature' : 'poll');
            expect(controller.state.base.activeQueue).toEqual(nextAnchor ? ['poll'] : []);
            expect(controller.state.progress?.finishedPromos).not.toContain('coolNewFeature');

            releaseSecond();
            await waitForNextTick();
            expect(controller.getActivePromo()).toBe(nextAnchor ? 'coolNewFeature' : 'poll');
            expect(onboardingController.hintStore.state.hint?.step.slug).toBe(
                nextAnchor ? 'nextCoolFeature' : undefined,
            );
        },
    );

    it('waits for an already pending hint while onboarding progress loads', async () => {
        const {promise: pendingProgress, resolve: resolveProgress} =
            createDeferred<Partial<ProgressState>>();
        const onboardingController = new OnboardingController({
            ...getOptionsWithPromo({wizardState: 'hidden'}),
            getProgressState: () => pendingProgress,
        });
        const appearance = onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });
        await waitForNextTick();

        const unavailable = vi.fn();
        const nextHint = getHintTransitions(onboardingController).waitForNextHint(
            'coolNewFeature',
            unavailable,
        );
        resolveProgress({});

        await nextHint;
        expect(unavailable).not.toHaveBeenCalled();
        await appearance;
        expect(onboardingController.hintStore.state.open).toBe(true);
        expect(onboardingController.hintStore.state.hint?.step.slug).toBe('showCoolFeature');
    });

    it('releases a failed transition while another preset owns the open hint', async () => {
        const {promise: pendingHint, resolve: releaseHint} = createDeferred();
        const {onboardingController, controller, reach} = getMultistepData({
            beforeShowHint: async ({stepData}) => {
                if (stepData.stepSlug === 'nextCoolFeature') {
                    await pendingHint;
                }
            },
        });
        await controller.ensureInit();
        await reach('showCoolFeature');
        await reach('nextCoolFeature');
        await controller.requestStart('poll');
        await onboardingController.passStep('showCoolFeature');
        await waitForNextTick();

        await onboardingController.setWizardState('visible');
        await reach('openBoard');
        expect(onboardingController.hintStore.state.hint?.preset).toBe('createProject');
        releaseHint();
        await waitForNextTick();
        onboardingController.closeHintByUser();
        await waitForNextTick();

        expect(onboardingController.hintStore.state.open).toBe(false);
        expect(controller.getActivePromo()).toBe('poll');
        expect(controller.state.base.activeQueue).toEqual([]);
    });

    it.each([
        {event: 'stepElementReached', thirdAnchor: true},
        {event: 'beforeShowHint', thirdAnchor: true},
        {event: 'beforeShowHint', thirdAnchor: false},
    ] as const)(
        'handles progress advancing during $event with the next anchor present: $thirdAnchor',
        async ({event, thirdAnchor}) => {
            let transitioning = false;
            const {promise: secondGate, resolve: releaseSecond} = createDeferred();
            const {promise: thirdGate, resolve: releaseThird} = createDeferred();
            const {onboardingController, controller, preset, reach} = getMultistepData({
                stepElementReached: async ({stepData}) => {
                    if (
                        event === 'stepElementReached' &&
                        transitioning &&
                        stepData.stepSlug === 'nextCoolFeature'
                    ) {
                        await secondGate;
                    }
                },
                beforeShowHint: async ({stepData}) => {
                    if (
                        event === 'beforeShowHint' &&
                        transitioning &&
                        stepData.stepSlug === 'nextCoolFeature'
                    ) {
                        await secondGate;
                    }
                    if (stepData.stepSlug === 'thirdStep') {
                        await thirdGate;
                    }
                },
            });
            preset.steps.push({slug: 'thirdStep', name: '', description: ''});
            await controller.ensureInit();
            for (const stepSlug of [
                'showCoolFeature',
                'nextCoolFeature',
                ...(thirdAnchor ? ['thirdStep'] : []),
            ]) {
                await reach(stepSlug);
            }
            await controller.requestStart('poll');
            transitioning = true;
            await onboardingController.passStep('showCoolFeature');
            await waitForNextTick();
            expect(controller.getActivePromo()).toBe('coolNewFeature');
            await onboardingController.passStep('nextCoolFeature');
            await waitForNextTick();
            const activeBeforeObsoleteCheckSettles = controller.getActivePromo();
            releaseSecond();
            await waitForNextTick();
            const activeWhileThirdIsLoading = controller.getActivePromo();
            const hintOpenWhileThirdIsLoading = onboardingController.hintStore.state.open;
            releaseThird();
            await waitForNextTick();
            expect(activeBeforeObsoleteCheckSettles).toBe(thirdAnchor ? 'coolNewFeature' : 'poll');
            expect(activeWhileThirdIsLoading).toBe(thirdAnchor ? 'coolNewFeature' : 'poll');
            expect(hintOpenWhileThirdIsLoading).toBe(false);
            expect(controller.getActivePromo()).toBe(thirdAnchor ? 'coolNewFeature' : 'poll');
            expect(onboardingController.hintStore.state.hint?.step.slug).toBe(
                thirdAnchor ? 'thirdStep' : undefined,
            );
        },
    );

    it.each(['immediate pass', 'pending duplicate'] as const)(
        'leaves a shown hint to its close handlers after %s',
        async (scenario) => {
            const {promise: duplicateGate, resolve: releaseDuplicate} = createDeferred();
            const {promise: closeGate, resolve: releaseClose} = createDeferred();
            let attempts = 0;
            let passed: Promise<void> | undefined;
            const {onboardingController, controller, reach} = getMultistepData({
                beforeShowHint: ({stepData}) => {
                    if (
                        stepData.stepSlug === 'showCoolFeature' &&
                        ++attempts > 1 &&
                        scenario === 'pending duplicate'
                    ) {
                        return duplicateGate;
                    }
                    return undefined;
                },
                closeHint: () => closeGate,
                hintDataChanged: ({state}, instance) => {
                    if (
                        scenario === 'immediate pass' &&
                        state.open &&
                        state.hint?.step.slug === 'showCoolFeature'
                    ) {
                        passed = instance.passStep('showCoolFeature');
                    }
                },
            });
            await controller.ensureInit();
            await reach('showCoolFeature');
            await controller.requestStart('poll');
            if (scenario === 'pending duplicate') {
                expect(attempts).toBeGreaterThan(1);
                expect(onboardingController.hintStore.state.open).toBe(true);
                await onboardingController.passStep('showCoolFeature');
            } else {
                await passed;
            }
            releaseDuplicate();
            await waitForNextTick();
            const activeBeforeCloseSettles = controller.getActivePromo();
            releaseClose();
            await waitForNextTick();

            expect(activeBeforeCloseSettles).toBe('coolNewFeature');
            expect(controller.getActivePromo()).toBe('poll');
        },
    );

    it.each(['onShowHint', 'onCloseHintByUser'] as const)(
        'releases the slot after a synchronous close when passing via %s',
        async (scenario) => {
            let passed: Promise<void> | undefined;
            const {onboardingController, controller, preset, reach} = getMultistepData({
                hintDataChanged: ({state}, instance) => {
                    if (state.open) {
                        instance.closeHintByUser();
                    }
                },
            });
            if (scenario === 'onShowHint') {
                preset.steps[0].passMode = 'onShowHint';
            } else {
                preset.steps[0].hooks = {
                    onCloseHintByUser: () => {
                        passed = onboardingController.passStep('showCoolFeature');
                    },
                };
            }
            await controller.ensureInit();
            await reach('showCoolFeature');
            await passed;
            await controller.requestStart('poll');
            await waitForNextTick();

            expect(onboardingController.hintStore.state.open).toBe(false);
            expect(controller.getActivePromo()).toBe('poll');
            expect(controller.state.base.activeQueue).toEqual([]);
        },
    );

    it('does not block a later close hook needed by the next hint', async () => {
        const {promise: closeProcessed, resolve: resolveClose} = createDeferred();
        const {onboardingController, controller, reach} = getMultistepData({
            beforeShowHint: async ({stepData}) => {
                if (stepData.stepSlug === 'nextCoolFeature') {
                    await closeProcessed;
                }
            },
        });
        onboardingController.events.subscribe('closeHint', () => resolveClose());
        await controller.ensureInit();
        await reach('showCoolFeature');
        await reach('nextCoolFeature');
        await controller.requestStart('poll');
        await onboardingController.passStep('showCoolFeature');
        await waitForNextTick();
        expect(onboardingController.hintStore.state.hint?.step.slug).toBe('nextCoolFeature');
        expect(controller.getActivePromo()).toBe('coolNewFeature');
    });

    it('settles a transition when the next step passes on show', async () => {
        const {promise: pendingHook, resolve: resolveHook} = createDeferred();
        const {onboardingController, controller, preset, reach} = getMultistepData({
            beforeShowHint: async ({stepData}) => {
                if (stepData.stepSlug === 'nextCoolFeature') {
                    await pendingHook;
                }
            },
        });
        preset.steps[1].passMode = 'onShowHint';
        await controller.ensureInit();
        await reach('showCoolFeature');
        await reach('nextCoolFeature');
        await controller.requestStart('poll');
        await onboardingController.passStep('showCoolFeature');

        const unavailable = vi.fn();
        const nextHint = getHintTransitions(onboardingController).waitForNextHint(
            'coolNewFeature',
            unavailable,
        );
        await waitForNextTick();
        expect(controller.getActivePromo()).toBe('coolNewFeature');
        expect(onboardingController.hintStore.state.open).toBe(false);
        resolveHook();

        await nextHint;
        expect(unavailable).not.toHaveBeenCalled();
        await waitForNextTick();
        expect(onboardingController.state.progress?.finishedPresets).toContain('coolNewFeature');
        expect(controller.getActivePromo()).toBe('poll');
    });

    it.each(['available', 'missing', 'last'] as const)(
        'settles a user-closed onShowHint step with the next anchor %s',
        async (scenario) => {
            const {onboardingController, controller, preset, reach} = getMultistepData();
            preset.steps[0].passMode = 'onShowHint';
            if (scenario === 'last') {
                preset.steps.splice(1);
            }
            await controller.ensureInit();
            await reach('showCoolFeature');
            if (scenario === 'available') {
                await reach('nextCoolFeature');
            }
            await controller.requestStart('poll');

            onboardingController.closeHintByUser();
            await waitForNextTick();

            expect(controller.getActivePromo()).toBe(
                scenario === 'available' ? 'coolNewFeature' : 'poll',
            );
            expect(controller.state.base.activeQueue).toEqual(
                scenario === 'available' ? ['poll'] : [],
            );
            expect(onboardingController.hintStore.state.hint?.step.slug).toBe(
                scenario === 'available' ? 'nextCoolFeature' : undefined,
            );
            expect(controller.state.progress?.finishedPromos.includes('coolNewFeature')).toBe(
                scenario === 'last',
            );
        },
    );

    it.each(['cancelPromo', 'skipPromo', 'finishPromo', 'finishPreset'] as const)(
        'does not show a pending transition after %s',
        async (action) => {
            const {onboardingController, controller, reach} = getMultistepData();
            const {promise: gate, resolve: release} = createDeferred();
            const preparing = vi.fn(({stepData}) =>
                stepData.stepSlug === 'nextCoolFeature' ? gate : undefined,
            );
            onboardingController.events.subscribe('beforeShowHint', preparing);
            await controller.ensureInit();
            for (const stepSlug of ['showCoolFeature', 'nextCoolFeature']) {
                await reach(stepSlug);
            }
            await controller.requestStart('poll');
            preparing.mockClear();
            await onboardingController.passStep('showCoolFeature');
            await waitForNextTick();
            expect(preparing).toHaveBeenCalled();
            expect(controller.getActivePromo()).toBe('coolNewFeature');

            if (action === 'finishPreset') {
                await onboardingController.finishPreset('coolNewFeature');
            } else {
                controller[action]('coolNewFeature');
            }
            expect(controller.getActivePromo()).toBe('poll');
            release();
            await waitForNextTick();

            expect(controller.getActivePromo()).toBe('poll');
            expect(onboardingController.hintStore.state.open).toBe(false);
        },
    );

    it.each(['old first', 'new first'] as const)(
        'keeps a restarted promo independent of its old hint attempt: %s',
        async (order) => {
            const {onboardingController, controller, reach} = getMultistepData();
            const {promise: oldGate, resolve: releaseOld} = createDeferred();
            const {promise: newGate, resolve: releaseNew} = createDeferred();
            let restarted = false;
            let preparedRun = '';
            onboardingController.events.subscribe('beforeShowHint', async ({stepData}) => {
                if (stepData.stepSlug === 'nextCoolFeature') {
                    const isNew = restarted;
                    await (isNew ? newGate : oldGate);
                    preparedRun = isNew ? 'new' : 'old';
                }
            });
            const shows: string[] = [];
            onboardingController.events.subscribe('showHint', ({step}) => {
                if (step === 'nextCoolFeature') {
                    shows.push(preparedRun);
                }
            });
            await controller.ensureInit();
            for (const stepSlug of ['showCoolFeature', 'nextCoolFeature']) {
                await reach(stepSlug);
            }
            await onboardingController.passStep('showCoolFeature');
            await waitForNextTick();
            controller.skipPromo('coolNewFeature');
            restarted = true;
            const retry = reach('nextCoolFeature');
            await waitForNextTick();
            expect(controller.getActivePromo()).toBe('coolNewFeature');
            await controller.requestStart('poll');

            if (order === 'old first') {
                releaseOld();
                await waitForNextTick();
                expect(onboardingController.hintStore.state.open).toBe(false);
                expect(controller.getActivePromo()).toBe('coolNewFeature');
                releaseNew();
            } else {
                releaseNew();
                await retry;
                releaseOld();
            }
            await retry;
            await waitForNextTick();

            expect(shows).toEqual(['new']);
            expect(controller.getActivePromo()).toBe('coolNewFeature');
            expect(controller.state.base.activeQueue).toEqual(['poll']);
            expect(onboardingController.hintStore.state.hint?.step.slug).toBe('nextCoolFeature');
        },
    );

    it.each(['before', 'after'] as const)(
        'releases a rejected restarted promo without waiting for its canceled hint attempt with hook %s integration',
        async (order) => {
            const {promise: oldGate, resolve: releaseOld} = createDeferred();
            let restarted = false;
            const preparing = vi.fn(({stepData}) => {
                if (stepData.stepSlug !== 'nextCoolFeature') {
                    return true;
                }
                return restarted ? false : oldGate;
            });
            const {onboardingController, controller, reach} = getMultistepData(
                order === 'before' ? {beforeShowHint: preparing} : undefined,
            );
            if (order === 'after') {
                onboardingController.events.subscribe('beforeShowHint', preparing);
            }

            try {
                await controller.ensureInit();
                for (const stepSlug of ['showCoolFeature', 'nextCoolFeature']) {
                    await reach(stepSlug);
                }
                preparing.mockClear();
                await onboardingController.passStep('showCoolFeature');
                await waitForNextTick();
                expect(preparing).toHaveBeenCalled();
                expect(controller.getActivePromo()).toBe('coolNewFeature');
                expect(onboardingController.hintStore.state.open).toBe(false);

                controller.skipPromo('coolNewFeature');
                restarted = true;
                await reach('nextCoolFeature');
                await controller.requestStart('poll');
                await waitForNextTick();

                expect(controller.getActivePromo()).toBe('poll');
                expect(controller.state.base.activeQueue).toEqual([]);
                expect(onboardingController.hintStore.state.open).toBe(false);
            } finally {
                releaseOld();
                await waitForNextTick();
            }

            expect(controller.getActivePromo()).toBe('poll');
            expect(controller.state.base.activeQueue).toEqual([]);
            expect(onboardingController.hintStore.state.open).toBe(false);
        },
    );

    it.each([
        {hook: 'onCloseHintByUser', nextAnchor: true},
        {hook: 'onCloseHint', nextAnchor: true},
        {hook: 'onCloseHintByUser', nextAnchor: false},
        {hook: 'onCloseHint', nextAnchor: false},
    ] as const)(
        'preserves the transition started by $hook with next anchor: $nextAnchor',
        async ({hook, nextAnchor}) => {
            const {onboardingController, controller, preset, reach} = getMultistepData();
            let passed: Promise<void> | undefined;
            preset.steps[0].hooks = {
                [hook]: () => {
                    passed = onboardingController.passStep('showCoolFeature');
                },
            };
            await controller.ensureInit();
            await reach('showCoolFeature');
            if (nextAnchor) {
                await reach('nextCoolFeature');
            }
            await controller.requestStart('poll');

            onboardingController.closeHintByUser();
            expect(passed).toBeDefined();
            await passed;
            await waitForNextTick();

            expect(onboardingController.state.progress?.presetPassedSteps.coolNewFeature).toEqual([
                'showCoolFeature',
            ]);
            expect(controller.getActivePromo()).toBe(nextAnchor ? 'coolNewFeature' : 'poll');
            expect(controller.state.base.activeQueue).toEqual(nextAnchor ? ['poll'] : []);
            expect(onboardingController.hintStore.state.open).toBe(nextAnchor);
            expect(onboardingController.hintStore.state.hint?.step.slug).toBe(
                nextAnchor ? 'nextCoolFeature' : undefined,
            );
            expect(controller.state.progress?.finishedPromos).not.toContain('coolNewFeature');
        },
    );

    it.each(['shown', 'preparing'] as const)(
        'preserves a close-hook transition after a delayed close event when the next hint is %s',
        async (nextHintState) => {
            const {promise: closeGate, resolve: releaseClose} = createDeferred();
            const {promise: nextGate, resolve: releaseNext} = createDeferred();
            const {onboardingController, controller, preset, reach} = getMultistepData({
                closeHint: () => closeGate,
                beforeShowHint: ({stepData}) =>
                    nextHintState === 'preparing' && stepData.stepSlug === 'nextCoolFeature'
                        ? nextGate
                        : undefined,
            });
            let passed: Promise<void> | undefined;
            preset.steps[0].hooks = {
                onCloseHintByUser: () => {
                    passed = onboardingController.passStep('showCoolFeature');
                },
            };

            try {
                await controller.ensureInit();
                for (const stepSlug of ['showCoolFeature', 'nextCoolFeature']) {
                    await reach(stepSlug);
                }
                await controller.requestStart('poll');
                onboardingController.closeHintByUser();
                expect(passed).toBeDefined();
                await passed;
                await waitForNextTick();
                expect(onboardingController.hintStore.state.open).toBe(nextHintState === 'shown');
                expect(controller.getActivePromo()).toBe('coolNewFeature');

                releaseClose();
                await waitForNextTick();

                expect(controller.getActivePromo()).toBe('coolNewFeature');
                expect(controller.state.base.activeQueue).toEqual(['poll']);
                expect(onboardingController.hintStore.state.open).toBe(nextHintState === 'shown');

                releaseNext();
                await waitForNextTick();
                expect(controller.getActivePromo()).toBe('coolNewFeature');
                expect(onboardingController.hintStore.state.open).toBe(true);
                expect(onboardingController.hintStore.state.hint?.step.slug).toBe(
                    'nextCoolFeature',
                );
            } finally {
                releaseClose();
                releaseNext();
                await waitForNextTick();
            }
        },
    );

    it('preserves the next transition when an earlier hint passes during its start request', async () => {
        let passedSecond: Promise<void> | undefined;
        const secondAnchor = getAnchorElement();
        const {onboardingController, controller, preset, reach} = getMultistepData({
            beforeShowHint: ({stepData}, instance) => {
                if (stepData.stepSlug === 'nextCoolFeature' && !passedSecond) {
                    passedSecond = instance.passStep('nextCoolFeature');
                }
            },
        });
        preset.steps[1].hooks = {onStepPass: () => secondAnchor.remove()};
        preset.steps.push({slug: 'thirdStep', name: '', description: ''});
        await controller.ensureInit();
        for (const stepSlug of ['showCoolFeature', 'nextCoolFeature', 'thirdStep']) {
            await reach(
                stepSlug,
                stepSlug === 'nextCoolFeature' ? secondAnchor : getAnchorElement(),
            );
        }
        await controller.requestStart('poll');

        await onboardingController.passStep('showCoolFeature');
        expect(passedSecond).toBeDefined();
        await passedSecond;
        await waitForNextTick();

        expect(secondAnchor.isConnected).toBe(false);
        expect(onboardingController.state.progress?.presetPassedSteps.coolNewFeature).toEqual([
            'showCoolFeature',
            'nextCoolFeature',
        ]);
        expect(controller.getActivePromo()).toBe('coolNewFeature');
        expect(controller.state.base.activeQueue).toEqual(['poll']);
        expect(onboardingController.hintStore.state.open).toBe(true);
        expect(onboardingController.hintStore.state.hint?.step.slug).toBe('thirdStep');
        expect(controller.state.progress?.finishedPromos).not.toContain('coolNewFeature');
    });

    it.each(['start pass', 'await pass'] as const)(
        'preserves the transition started by a global close hook: %s',
        async (mode) => {
            let passed: Promise<void> | undefined;
            const {onboardingController, controller, reach} = getMultistepData({
                closeHint: ({hint}, instance) => {
                    if (hint.step.slug === 'showCoolFeature') {
                        passed = instance.passStep('showCoolFeature');
                        return mode === 'await pass' ? passed : undefined;
                    }
                    return undefined;
                },
            });
            await controller.ensureInit();
            for (const stepSlug of ['showCoolFeature', 'nextCoolFeature']) {
                await reach(stepSlug);
            }
            await controller.requestStart('poll');

            onboardingController.closeHintByUser();
            expect(passed).toBeDefined();
            await passed;
            await waitForNextTick();

            expect(onboardingController.state.progress?.presetPassedSteps.coolNewFeature).toEqual([
                'showCoolFeature',
            ]);
            expect(controller.getActivePromo()).toBe('coolNewFeature');
            expect(controller.state.base.activeQueue).toEqual(['poll']);
            expect(onboardingController.hintStore.state.open).toBe(true);
            expect(onboardingController.hintStore.state.hint?.step.slug).toBe('nextCoolFeature');
            expect(controller.state.progress?.finishedPromos).not.toContain('coolNewFeature');
        },
    );

    it('keeps a multi-step promo active until its last step is passed', async () => {
        const {onboardingController, controller, reach} = getMultistepData();
        await controller.ensureInit();
        await reach('showCoolFeature');
        await reach('nextCoolFeature');
        await controller.requestStart('poll');

        await onboardingController.passStep('showCoolFeature');
        await waitForNextTick();

        expect(controller.getActivePromo()).toBe('coolNewFeature');
        expect(controller.state.base.activeQueue).toEqual(['poll']);
        expect(onboardingController.hintStore.state.open).toBe(true);
        expect(onboardingController.hintStore.state.hint?.step.slug).toBe('nextCoolFeature');

        await onboardingController.passStep('nextCoolFeature');
        await waitForNextTick();

        expect(controller.getActivePromo()).toBe('poll');
        expect(onboardingController.hintStore.state.open).toBe(false);
        expect(controller.state.progress?.finishedPromos).toContain('coolNewFeature');
    });

    it.each(['not reached', 'disconnected', 'removed on close'] as const)(
        'releases the promo when its next anchor is %s and allows a later retry',
        async (anchorState) => {
            const {onboardingController, controller, reach} = getMultistepData(
                anchorState === 'removed on close'
                    ? {
                          hintDataChanged: ({state}, instance) => {
                              if (!state.open) {
                                  instance.reachedElements.get('nextCoolFeature')?.remove();
                              }
                          },
                      }
                    : undefined,
            );
            await controller.ensureInit();
            await reach('showCoolFeature');
            if (anchorState !== 'not reached') {
                const element = getAnchorElement();
                await reach('nextCoolFeature', element);
                if (anchorState === 'disconnected') {
                    element.remove();
                }
            }
            await controller.requestStart('poll');

            await onboardingController.passStep('showCoolFeature');
            await waitForNextTick();

            expect(controller.getActivePromo()).toBe('poll');
            expect(onboardingController.hintStore.state.open).toBe(false);
            expect(controller.state.progress?.finishedPromos).not.toContain('coolNewFeature');

            controller.finishPromo('poll');
            await reach('nextCoolFeature');

            expect(controller.getActivePromo()).toBe('coolNewFeature');
            expect(onboardingController.hintStore.state.open).toBe(true);
            expect(onboardingController.hintStore.state.hint?.step.slug).toBe('nextCoolFeature');
        },
    );

    it('releases a disabled onboarding without waiting for its next element hook', async () => {
        const {promise: pending, resolve: release} = createDeferred();
        let transitioning = false;
        const {onboardingController, controller, reach} = getMultistepData({
            stepElementReached: ({stepData}) =>
                transitioning && stepData.stepSlug === 'nextCoolFeature' ? pending : undefined,
        });

        try {
            await controller.ensureInit();
            await reach('showCoolFeature');
            await reach('nextCoolFeature');
            await controller.requestStart('poll');
            transitioning = true;
            await onboardingController.passStep('showCoolFeature');
            await waitForNextTick();
            expect(controller.getActivePromo()).toBe('coolNewFeature');
            expect(onboardingController.hintStore.state.open).toBe(false);

            await onboardingController.setOnboardingEnabled(false);
            await waitForNextTick();
            expect(controller.getActivePromo()).toBe('poll');
            expect(onboardingController.state.base.enabled).toBe(false);
            expect(controller.state.base.activeQueue).toEqual([]);

            release();
            await waitForNextTick();
            expect(controller.getActivePromo()).toBe('poll');
            expect(onboardingController.state.base.enabled).toBe(false);
            expect(onboardingController.hintStore.state.open).toBe(false);

            controller.finishPromo('poll');
            transitioning = false;
            await reach('nextCoolFeature');
            expect(onboardingController.state.base.enabled).toBe(true);
            expect(controller.getActivePromo()).toBe('coolNewFeature');
            expect(onboardingController.hintStore.state.hint?.step.slug).toBe('nextCoolFeature');
        } finally {
            release();
            await waitForNextTick();
        }
    });

    it.each(['beforeShowHint', 'stepElementReached'] as const)(
        'releases a disappeared next anchor without waiting for %s',
        async (event) => {
            const {promise: pending, resolve: release} = createDeferred();
            let transitioning = false;
            const preparing = vi.fn(({stepData}) =>
                transitioning && stepData.stepSlug === 'nextCoolFeature' ? pending : undefined,
            );
            const {onboardingController, controller, reach} = getMultistepData({
                [event]: preparing,
            });
            const element = getAnchorElement();

            try {
                await controller.ensureInit();
                await reach('showCoolFeature');
                await reach('nextCoolFeature', element);
                await controller.requestStart('poll');
                preparing.mockClear();
                transitioning = true;
                await onboardingController.passStep('showCoolFeature');
                await waitForNextTick();
                expect(preparing).toHaveBeenCalled();
                expect(controller.getActivePromo()).toBe('coolNewFeature');

                element.remove();
                onboardingController.stepElementDisappeared('nextCoolFeature');
                await waitForNextTick();

                expect(controller.getActivePromo()).toBe('poll');
                expect(onboardingController.hintStore.state.open).toBe(false);
                expect(controller.state.progress?.finishedPromos).not.toContain('coolNewFeature');

                controller.finishPromo('poll');
                transitioning = false;
                const replacement = getAnchorElement();
                await reach('nextCoolFeature', replacement);
                release();
                await waitForNextTick();

                expect(controller.getActivePromo()).toBe('coolNewFeature');
                expect(onboardingController.hintStore.state.open).toBe(true);
                expect(onboardingController.hintStore.state.anchorRef.current).toBe(replacement);
            } finally {
                release();
                await waitForNextTick();
            }
        },
    );

    it.each(['original', 'replacement'] as const)(
        'keeps the slot when a pending anchor is replaced asynchronously and the %s attempt resolves first',
        async (first) => {
            const original = getAnchorElement();
            const replacement = getAnchorElement();
            const oldGate = createDeferred();
            const newGate = createDeferred();
            const {onboardingController, controller, reach} = getMultistepData({
                beforeShowHint: ({stepData}) =>
                    stepData.stepSlug === 'nextCoolFeature'
                        ? (stepData.element === original ? oldGate : newGate).promise
                        : undefined,
            });
            const shown = vi.fn();
            onboardingController.events.subscribe('showHint', shown);
            let appearance: Promise<void> | undefined;

            try {
                await controller.ensureInit();
                await reach('showCoolFeature');
                await reach('nextCoolFeature', original);
                await controller.requestStart('poll');
                await onboardingController.passStep('showCoolFeature');
                await waitForNextTick();
                shown.mockClear();

                original.remove();
                onboardingController.stepElementDisappeared('nextCoolFeature');
                appearance = Promise.resolve().then(() => reach('nextCoolFeature', replacement));
                await waitForNextTick();
                expect(controller.getActivePromo()).toBe('coolNewFeature');
                expect(controller.state.base.activeQueue).toEqual(['poll']);
                expect(onboardingController.hintStore.state.open).toBe(false);

                (first === 'original' ? oldGate : newGate).resolve();
                await waitForNextTick();
                expect(onboardingController.hintStore.state.open).toBe(true);
                expect(onboardingController.hintStore.state.anchorRef.current).toBe(replacement);

                oldGate.resolve();
                newGate.resolve();
                await appearance;
                await waitForNextTick();
                expect(shown).toHaveBeenCalledOnce();
                expect(controller.getActivePromo()).toBe('coolNewFeature');
                expect(controller.state.base.activeQueue).toEqual(['poll']);
            } finally {
                oldGate.resolve();
                newGate.resolve();
                await appearance;
                await waitForNextTick();
            }
        },
    );

    it('allows a new attempt registered after the previous anchor becomes unavailable', async () => {
        const {promise: pending, resolve: release} = createDeferred();
        const {onboardingController, controller, reach} = getMultistepData({
            beforeShowHint: ({stepData}) =>
                stepData.stepSlug === 'nextCoolFeature' ? pending : undefined,
        });
        const original = getAnchorElement();
        const replacement = getAnchorElement();
        let appearance: Promise<void> | undefined;

        try {
            await controller.ensureInit();
            await reach('showCoolFeature');
            await reach('nextCoolFeature', original);
            await onboardingController.passStep('showCoolFeature');
            await waitForNextTick();

            original.remove();
            onboardingController.stepElementDisappeared('nextCoolFeature');
            appearance = Promise.resolve()
                .then(() => {})
                .then(() => reach('nextCoolFeature', replacement));
            await waitForNextTick();
            release();
            await appearance;
            await waitForNextTick();

            expect(controller.getActivePromo()).toBe('coolNewFeature');
            expect(onboardingController.hintStore.state.open).toBe(true);
            expect(onboardingController.hintStore.state.anchorRef.current).toBe(replacement);
        } finally {
            release();
            await appearance;
            await waitForNextTick();
        }
    });

    it.each([
        {event: 'beforeShowHint', result: 'remove', order: 'before', slowClose: false},
        {event: 'beforeShowHint', result: 'reject', order: 'before', slowClose: false},
        {event: 'beforeShowHint', result: 'reject', order: 'after', slowClose: false},
        {event: 'stepElementReached', result: 'reject', order: 'before', slowClose: false},
        {event: 'beforeShowHint', result: 'reject', order: 'before', slowClose: true},
    ] as const)(
        'releases a failed transition: $event, $result, $order integration, slow close: $slowClose',
        async ({event, result, order, slowClose}) => {
            const hook: NonNullable<InitOptions<{}, string, string>['hooks']>['beforeShowHint'] = ({
                stepData,
            }) => {
                if (stepData.stepSlug === 'nextCoolFeature') {
                    if (result === 'remove') {
                        stepData.element.remove();
                    } else {
                        return false;
                    }
                }
                return true;
            };
            const {promise: pendingClose, resolve: resolveClose} = createDeferred();
            const {onboardingController, controller, reach} = getMultistepData({
                ...(order === 'before' ? {[event]: hook} : {}),
                closeHint: slowClose ? () => pendingClose : undefined,
            });
            if (order === 'after') {
                onboardingController.events.subscribe(event, hook);
            }
            await controller.ensureInit();
            await reach('showCoolFeature');
            await reach('nextCoolFeature');
            await controller.requestStart('poll');

            await onboardingController.passStep('showCoolFeature');
            await waitForNextTick();

            if (slowClose) {
                expect(controller.getActivePromo()).toBe('coolNewFeature');
                resolveClose();
                await waitForNextTick();
            }
            expect(controller.getActivePromo()).toBe('poll');
            expect(onboardingController.hintStore.state.open).toBe(false);
            expect(controller.state.progress?.finishedPromos).not.toContain('coolNewFeature');
            expect(onboardingController.state.progress?.presetPassedSteps.coolNewFeature).toEqual([
                'showCoolFeature',
            ]);
            resolveClose();
            await waitForNextTick();
            expect(controller.getActivePromo()).toBe('poll');
        },
    );

    it('waits for a pending element hook when another attempt rejects the next hint', async () => {
        let transitioning = false;
        let attempts = 0;
        let allowedAttempt: object | undefined;
        const {promise: pendingHook, resolve: resolveHook} = createDeferred();
        const {onboardingController, controller, reach} = getMultistepData({
            stepElementReached: async ({stepData}) => {
                if (transitioning && stepData.stepSlug === 'nextCoolFeature') {
                    attempts++;
                    if (attempts === 1) {
                        allowedAttempt = stepData;
                        await pendingHook;
                    }
                }
            },
            beforeShowHint: ({stepData}) => {
                if (transitioning && stepData.stepSlug === 'nextCoolFeature') {
                    return stepData === allowedAttempt;
                }
                return true;
            },
        });
        await controller.ensureInit();
        await reach('showCoolFeature');
        await reach('nextCoolFeature');
        await controller.requestStart('poll');
        await waitForNextTick();
        transitioning = true;

        await onboardingController.passStep('showCoolFeature');
        await waitForNextTick();

        expect(attempts).toBeGreaterThan(1);
        expect(controller.getActivePromo()).toBe('coolNewFeature');
        expect(onboardingController.hintStore.state.open).toBe(false);

        resolveHook();
        await waitForNextTick();

        expect(controller.getActivePromo()).toBe('coolNewFeature');
        expect(controller.state.base.activeQueue).toEqual(['poll']);
        expect(onboardingController.hintStore.state.hint?.step.slug).toBe('nextCoolFeature');
        expect(onboardingController.hintStore.state.open).toBe(true);
    });

    it.each([
        {previousAnchorAvailable: true, returnToCurrentStep: false},
        {previousAnchorAvailable: false, returnToCurrentStep: false},
        {previousAnchorAvailable: true, returnToCurrentStep: true},
    ])(
        'handles backward navigation, previous anchor: $previousAnchorAvailable, forward again before close handling: $returnToCurrentStep',
        async ({previousAnchorAvailable, returnToCurrentStep}) => {
            const {promise: closeGate, resolve: releaseClose} = createDeferred();
            const onboardingOptions = getOptionsWithPromo({wizardState: 'hidden'});
            const preset = onboardingOptions.config.presets.coolNewFeature;
            let goBack!: () => void;
            const onboardingController = new OnboardingController({
                ...onboardingOptions,
                hooks: {
                    closeHint: ({eventSource}) =>
                        returnToCurrentStep && eventSource === 'externalEvent'
                            ? closeGate
                            : undefined,
                },
                config: {
                    presets: {
                        ...onboardingOptions.config.presets,
                        coolNewFeature: createPreset(({goPrevStep}) => {
                            goBack = goPrevStep;
                            return {
                                ...preset,
                                steps: [
                                    ...preset.steps,
                                    {slug: 'nextCoolFeature', name: '', description: ''},
                                ],
                            };
                        }),
                    },
                },
            });
            const controller = new Controller({
                ...testOptions,
                config: {
                    promoGroups: [
                        {slug: 'hintPromos', promos: []},
                        {slug: 'polls', promos: [{slug: 'poll'}]},
                    ],
                },
                onboarding: {getInstance: () => onboardingController, groupSlug: 'hintPromos'},
            });
            await controller.ensureInit();
            const previousAnchor = getAnchorElement();
            await onboardingController.stepElementReached({
                stepSlug: 'showCoolFeature',
                element: previousAnchor,
            });
            await onboardingController.stepElementReached({
                stepSlug: 'nextCoolFeature',
                element: getAnchorElement(),
            });
            await onboardingController.passStep('showCoolFeature');
            await waitForNextTick();
            expect(onboardingController.hintStore.state.hint?.step.slug).toBe('nextCoolFeature');
            await controller.requestStart('poll');
            if (!previousAnchorAvailable) {
                previousAnchor.remove();
            }

            try {
                goBack();
                await waitForNextTick();

                expect(controller.getActivePromo()).toBe(
                    previousAnchorAvailable ? 'coolNewFeature' : 'poll',
                );
                expect(controller.state.base.activeQueue).toEqual(
                    previousAnchorAvailable ? ['poll'] : [],
                );
                expect(onboardingController.hintStore.state.hint?.step.slug).toBe(
                    previousAnchorAvailable ? 'showCoolFeature' : undefined,
                );
                expect(onboardingController.hintStore.state.open).toBe(previousAnchorAvailable);
                expect(
                    onboardingController.state.progress?.presetPassedSteps.coolNewFeature,
                ).toEqual([]);
                expect(controller.state.progress?.finishedPromos).not.toContain('coolNewFeature');

                if (returnToCurrentStep) {
                    await onboardingController.passStep('showCoolFeature');
                    await waitForNextTick();
                    expect(onboardingController.hintStore.state.hint?.step.slug).toBe(
                        'nextCoolFeature',
                    );

                    releaseClose();
                    await waitForNextTick();

                    expect(controller.getActivePromo()).toBe('coolNewFeature');
                    expect(controller.state.base.activeQueue).toEqual(['poll']);
                    expect(onboardingController.hintStore.state.hint?.step.slug).toBe(
                        'nextCoolFeature',
                    );
                    expect(onboardingController.hintStore.state.open).toBe(true);
                }
            } finally {
                releaseClose();
                await waitForNextTick();
            }
        },
    );

    it('reach element -> activate promo', async function () {
        const {options, onboardingController} = getData();

        const controller = new Controller(options);

        await controller.ensureInit();

        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });

        await expect(controller.state.base.activePromo).toBe('coolNewFeature');
    });

    it('pass preset -> finish promo', async function () {
        const {options, onboardingController} = getData();

        const controller = new Controller(options);

        await controller.ensureInit();

        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });
        await onboardingController.passStep('showCoolFeature');

        expect(controller.state.base.activePromo).toBe(null);
        expect(controller.state.progress?.finishedPromos).toContain('coolNewFeature');
    });

    it('element disappears -> cancel start promo', async function () {
        const {options, onboardingController} = getData();

        const controller = new Controller(options);

        await controller.ensureInit();

        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });
        await onboardingController.stepElementDisappeared('showCoolFeature');

        expect(controller.state.base.activePromo).toBe(null);
        expect(controller.state.progress?.finishedPromos).not.toContain('coolNewFeature');
    });

    it('anchor disappears during initialization -> skip promo and allow another attempt', async function () {
        vi.useFakeTimers();
        try {
            const {options, onboardingController} = getData();
            const controller = new Controller({
                ...options,
                config: {
                    ...options.config,
                    init: {initType: 'timeout', timeout: 3000},
                },
            });
            const element = getAnchorElement();
            const appearance = onboardingController.stepElementReached({
                stepSlug: 'showCoolFeature',
                element,
            });
            await vi.advanceTimersByTimeAsync(0);
            expect(controller.state.base.activeQueue).toEqual(['coolNewFeature']);
            expect(onboardingController.hintStore.state.open).toBe(false);

            element.remove();
            onboardingController.stepElementDisappeared('showCoolFeature');
            await vi.advanceTimersByTimeAsync(3000);
            await appearance;

            expect(controller.state.base.activePromo).toBe(null);
            expect(controller.state.base.activeQueue).toEqual([]);
            expect(controller.state.progress?.finishedPromos).toEqual([]);
            expect(controller.state.progress?.progressInfoByPromo).toEqual({});
            expect(onboardingController.hintStore.state.open).toBe(false);
            expect(onboardingController.state.progress?.finishedPresets).toEqual([]);
            expect(onboardingController.state.progress?.presetPassedSteps).toEqual({});

            await onboardingController.stepElementReached({
                stepSlug: 'showCoolFeature',
                element: getAnchorElement(),
            });

            expect(controller.state.base.activePromo).toBe('coolNewFeature');
            expect(onboardingController.hintStore.state.open).toBe(true);
            expect(onboardingController.hintStore.state.hint?.step.slug).toBe('showCoolFeature');
        } finally {
            vi.useRealTimers();
        }
    });

    it('anchor replaced during initialization -> show hint on the replacement', async function () {
        vi.useFakeTimers();
        try {
            const {options, onboardingController} = getData();
            const controller = new Controller({
                ...options,
                config: {
                    ...options.config,
                    init: {initType: 'timeout', timeout: 3000},
                },
            });
            const showHint = vi.fn();
            onboardingController.events.subscribe('showHint', showHint);
            const element = getAnchorElement();
            const originalAppearance = onboardingController.stepElementReached({
                stepSlug: 'showCoolFeature',
                element,
            });
            await vi.advanceTimersByTimeAsync(0);
            expect(controller.state.base.activeQueue).toEqual(['coolNewFeature']);

            element.remove();
            onboardingController.stepElementDisappeared('showCoolFeature');
            const replacement = getAnchorElement();
            const replacementAppearance = onboardingController.stepElementReached({
                stepSlug: 'showCoolFeature',
                element: replacement,
            });
            await vi.advanceTimersByTimeAsync(0);
            expect(onboardingController.reachedElements.get('showCoolFeature')).toBe(replacement);
            expect(onboardingController.hintStore.state.open).toBe(false);

            await vi.advanceTimersByTimeAsync(3000);
            await Promise.all([originalAppearance, replacementAppearance]);

            expect(controller.state.base.activePromo).toBe('coolNewFeature');
            expect(onboardingController.hintStore.state.open).toBe(true);
            expect(onboardingController.hintStore.state.anchorRef.current).toBe(replacement);
            expect(showHint).toHaveBeenCalledOnce();
            expect(controller.state.progress?.finishedPromos).toEqual([]);
        } finally {
            vi.useRealTimers();
        }
    });

    it('cant run promo preset now -> delete from queue', async function () {
        const onboardingController = new OnboardingController(
            getOptionsWithPromo({wizardState: 'hidden'}),
        );

        const controller = new Controller({
            ...testOptions,
            config: {
                promoGroups: [
                    {
                        slug: 'somePromoGroup',
                        conditions: [],
                        promos: [{slug: 'someOtherPromo'}],
                    },
                    {
                        slug: 'hintPromos',
                        conditions: [],
                        promos: [],
                    },
                ],
            },
            onboarding: {
                getInstance: () => onboardingController,
                groupSlug: 'hintPromos',
            },
        });

        await controller.ensureInit();

        await controller.requestStart('someOtherPromo');
        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });

        expect(controller.state.base.activeQueue).not.toContain('coolNewFeature');
    });

    it('cancelled hint -> not trigger promo run', async function () {
        const onboardingController = new OnboardingController(
            getOptionsWithPromo({wizardState: 'visible'}),
        );

        const options = {
            ...testOptions,
            config: {
                promoGroups: [
                    {
                        slug: 'hintPromos',
                        conditions: [],
                        promos: [],
                    },
                ],
            },
            onboarding: {
                getInstance: () => onboardingController,
                groupSlug: 'hintPromos',
            },
            debugMode: true,
        };

        const controller = new Controller(options);
        await controller.ensureInit();

        // show promo hint with visible guide
        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });

        expect(controller.state.base.activePromo).toBe(null);
    });
});

describe('reset progress', function () {
    it('reset promoManager progress -> erase onboarding presets', async function () {
        const {options, onboardingController} = getData();
        const controller = new Controller(options);

        await controller.resetToDefaultState();

        expect(onboardingController.state.base.activePresets).toEqual(['createProject']);
        expect(onboardingController.state.base.suggestedPresets).toEqual(['createProject']);

        expect(onboardingController.state.progress).toEqual({
            finishedPresets: [],
            presetPassedSteps: {},
        });
    });

    it('reset onboarding promo preset progress -> remove promo progress', async function () {
        const {options, onboardingController} = getData();
        const controller = new Controller(options);

        await controller.ensureInit();
        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });
        await onboardingController.passStep('showCoolFeature');

        await onboardingController.resetPresetProgress('coolNewFeature');

        expect(controller.state.progress?.finishedPromos).toEqual([]);
        expect(controller.state.progress?.progressInfoByPromo.coolNewFeature).toBe(undefined);
    });
});
