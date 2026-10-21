import {Controller as OnboardingController} from '../../controller';
import {Controller} from '../core/controller';
import {testOptions} from './options';
import {getAnchorElement, getOptionsWithPromo} from '../../tests/utils';
import {waitForNextTick} from './utils';
import {MultiTabSyncPlugin} from '../../plugins/multi-tab-sync';

const getData = (stepSlugs = ['showCoolFeature'], passMode?: 'onAction' | 'onShowHint') => {
    const onboardingOptions = getOptionsWithPromo({wizardState: 'hidden'});
    onboardingOptions.config.presets.coolNewFeature.steps = stepSlugs.map((slug) => ({
        slug,
        name: '',
        description: '',
        passMode,
    }));
    const onboardingController = new OnboardingController(onboardingOptions);
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

describe('skipping steps', function () {
    it.each([{stepSlugs: ['showCoolFeature']}, {stepSlugs: []}])(
        'force-finish a promo preset with unresolved steps $stepSlugs -> finish the promo',
        async function ({stepSlugs}) {
            const {options, onboardingController} = getData(stepSlugs);
            const controller = new Controller(options);
            const finishPromo = vi.fn();
            controller.events.subscribe('finishPromo', finishPromo);
            await controller.requestStart('coolNewFeature');

            await onboardingController.finishPreset('coolNewFeature');

            expect(onboardingController.state.progress?.presetPassedSteps.coolNewFeature).toBe(
                undefined,
            );
            expect(controller.state.progress?.finishedPromos).toEqual(['coolNewFeature']);
            expect(controller.state.base.activePromo).toBe(null);
            expect(finishPromo).toHaveBeenCalledOnce();
        },
    );

    it('a failing skip terminal subscriber -> still cancel the promo and release it', async function () {
        const {options, onboardingController} = getData();
        const error = new Error('Analytics failed');
        const failingListener = vi.fn(async () => {
            throw error;
        });
        onboardingController.events.subscribe('skipPreset', failingListener);
        const controller = new Controller({
            ...options,
            config: {
                promoGroups: [{slug: 'hintPromos', promos: [{slug: 'otherPromo'}]}],
            },
        });
        const finishPromo = vi.fn();
        const cancelPromo = vi.fn();
        controller.events.subscribe('finishPromo', finishPromo);
        controller.events.subscribe('cancelPromo', cancelPromo);
        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });

        await expect(onboardingController.skipStep('showCoolFeature')).rejects.toThrow(error);

        expect(controller.state.base.activePromo).toBe(null);
        expect(onboardingController.state.progress?.finishedPresets).toContain('coolNewFeature');
        expect(controller.state.progress?.finishedPromos).toEqual([]);
        expect(controller.state.progress?.progressInfoByPromo.coolNewFeature).toBeDefined();
        expect(failingListener).toHaveBeenCalledOnce();
        expect(finishPromo).not.toHaveBeenCalled();
        expect(cancelPromo).toHaveBeenCalledOnce();
        expect(await controller.requestStart('otherPromo')).toBe(true);
    });

    it.each(['active', 'pending'] as const)(
        'skip a %s repeatable run after an earlier cancellation -> cancel the current run',
        async function (runStatus) {
            const {options, onboardingController} = getData();
            const controller = new Controller({
                ...options,
                config: {
                    ...options.config,
                    promoGroups: [
                        {...options.config.promoGroups[0], repeatable: true},
                        {slug: 'otherPromos', promos: [{slug: 'otherPromo'}]},
                    ],
                },
            });
            const cancelPromo = vi.fn();
            controller.events.subscribe('cancelPromo', cancelPromo);
            await controller.requestStart('coolNewFeature');
            controller.cancelPromo('coolNewFeature');
            if (runStatus === 'pending') {
                await controller.requestStart('otherPromo');
            }
            await controller.requestStart('coolNewFeature');
            if (runStatus === 'active') {
                expect(controller.state.base.activePromo).toBe('coolNewFeature');
            } else {
                expect(controller.state.base.activeQueue).toEqual(['coolNewFeature']);
            }

            await onboardingController.skipStep('showCoolFeature');

            expect(controller.state.base.activePromo).toBe(
                runStatus === 'active' ? null : 'otherPromo',
            );
            expect(controller.state.base.activeQueue).toEqual([]);
            expect(controller.state.progress?.finishedPromos).toEqual([]);
            expect(cancelPromo).toHaveBeenCalledTimes(2);
            expect(await controller.requestStart('otherPromo')).toBe(true);
        },
    );

    it('receiving a mixed preset outcome -> finish the promo and close its resolved hint', async function () {
        const syncPlugin = new MultiTabSyncPlugin();
        const onboardingOptions = getOptionsWithPromo({wizardState: 'hidden'});
        onboardingOptions.config.presets.coolNewFeature.steps.push({
            slug: 'followUpFeature',
            name: '',
            description: '',
        });
        onboardingOptions.plugins.push(syncPlugin);
        const onboardingController = new OnboardingController(onboardingOptions);
        const controller = new Controller({
            ...testOptions,
            config: {
                promoGroups: [{slug: 'hintPromos', promos: [{slug: 'otherPromo'}]}],
            },
            onboarding: {getInstance: () => onboardingController, groupSlug: 'hintPromos'},
        });
        const finishPromo = vi.fn();
        const cancelPromo = vi.fn();
        const userClose = vi.fn();
        controller.events.subscribe('finishPromo', finishPromo);
        controller.events.subscribe('cancelPromo', cancelPromo);
        onboardingController.events.subscribe('closeHintByUser', userClose);
        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });

        expect(await controller.requestStart('otherPromo')).toBe(false);
        expect(controller.state.base.activeQueue).toEqual(['otherPromo']);

        await syncPlugin.handleLSEvent(
            new StorageEvent('storage', {
                key: 'onboarding.plugin-sync.skipStep',
                newValue: JSON.stringify({
                    preset: 'coolNewFeature',
                    step: 'followUpFeature',
                    passedSteps: ['showCoolFeature'],
                    skippedSteps: ['followUpFeature'],
                    closeHint: false,
                    nonce: 'remote-mixed',
                }),
            }),
        );

        expect(onboardingController.hintStore.state.open).toBe(false);
        expect(controller.state.base.activePromo).toBe('otherPromo');
        expect(controller.state.base.activeQueue).toEqual([]);
        expect(controller.state.progress?.finishedPromos).toEqual(['coolNewFeature']);
        expect(finishPromo).toHaveBeenCalledOnce();
        expect(cancelPromo).not.toHaveBeenCalled();
        expect(userClose).not.toHaveBeenCalled();
        expect(await controller.requestStart('otherPromo')).toBe(true);
    });

    it('receiving a complete default sync batch -> cancel after callbacks and start the queued promo', async function () {
        const syncPlugin = new MultiTabSyncPlugin();
        const onboardingOptions = getOptionsWithPromo({wizardState: 'hidden'});
        let releaseHook!: () => void;
        let notifyHookStarted!: () => void;
        let slowHookCompleted = false;
        const hookPermission = new Promise<void>((resolve) => {
            releaseHook = resolve;
        });
        const hookStarted = new Promise<void>((resolve) => {
            notifyHookStarted = resolve;
        });
        const slowHook = vi.fn(async () => {
            notifyHookStarted();
            await hookPermission;
            slowHookCompleted = true;
        });
        const stepSlugs = ['showCoolFeature', 'followUpFeature', 'lastFeature'];
        onboardingOptions.config.presets.coolNewFeature.steps = stepSlugs.map((slug) => ({
            slug,
            name: '',
            description: '',
            hooks: slug === 'lastFeature' ? {onStepSkip: slowHook} : undefined,
        }));
        onboardingOptions.plugins.push(syncPlugin);
        const onboardingController = new OnboardingController(onboardingOptions);
        const controller = new Controller({
            ...testOptions,
            config: {
                promoGroups: [{slug: 'hintPromos', promos: [{slug: 'otherPromo'}]}],
            },
            onboarding: {getInstance: () => onboardingController, groupSlug: 'hintPromos'},
        });
        const terminalObservations: {hintOpen: boolean; hookCompleted: boolean}[] = [];
        const cancelPromo = vi.fn(() => {
            terminalObservations.push({
                hintOpen: onboardingController.hintStore.state.open,
                hookCompleted: slowHookCompleted,
            });
        });
        const stepSkip = vi.fn();
        const userClose = vi.fn();
        controller.events.subscribe('cancelPromo', cancelPromo);
        onboardingController.events.subscribe('stepSkip', stepSkip);
        onboardingController.events.subscribe('closeHintByUser', userClose);
        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });
        expect(await controller.requestStart('otherPromo')).toBe(false);
        const syncing = syncPlugin.handleLSEvent(
            new StorageEvent('storage', {
                key: syncPlugin.options.skipStepLSKey,
                newValue: JSON.stringify({
                    preset: 'coolNewFeature',
                    step: 'lastFeature',
                    skippedSteps: stepSlugs,
                }),
            }),
        );
        await hookStarted;

        expect(controller.state.base.activePromo).toBe('coolNewFeature');
        expect(onboardingController.state.progress?.presetSkippedSteps?.coolNewFeature).toEqual(
            stepSlugs,
        );
        expect(cancelPromo).not.toHaveBeenCalled();
        releaseHook();
        await syncing;

        expect(onboardingController.hintStore.state.open).toBe(false);
        expect(controller.state.base.activePromo).toBe('otherPromo');
        expect(controller.state.base.activeQueue).toEqual([]);
        expect(terminalObservations).toEqual([{hintOpen: false, hookCompleted: true}]);
        expect(slowHook).toHaveBeenCalledOnce();
        expect(stepSkip).toHaveBeenCalledTimes(3);
        expect(userClose).not.toHaveBeenCalled();
        expect(cancelPromo).toHaveBeenCalledOnce();
        expect(controller.state.progress?.finishedPromos).toEqual([]);
        expect(controller.state.progress?.progressInfoByPromo.coolNewFeature).toBeDefined();
    });

    it('skip all steps -> cancel only when the preset ends', async function () {
        const {options, onboardingController} = getData(['showCoolFeature', 'followUpFeature']);
        const controller = new Controller(options);
        const cancelPromo = vi.fn();
        controller.events.subscribe('cancelPromo', cancelPromo);
        await controller.ensureInit();
        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });

        await onboardingController.skipStep('showCoolFeature');

        expect(controller.state.base.activePromo).toBe('coolNewFeature');
        expect(controller.state.progress?.progressInfoByPromo.coolNewFeature).toBeUndefined();
        expect(cancelPromo).not.toHaveBeenCalled();

        await onboardingController.skipStep('followUpFeature');
        await waitForNextTick();

        expect(controller.state.base.activePromo).toBe(null);
        expect(controller.state.progress?.finishedPromos).toEqual([]);
        expect(controller.state.progress?.progressInfoByPromo.coolNewFeature).toBeDefined();
        expect(cancelPromo).toHaveBeenCalledOnce();
    });

    it('skip while initialization is pending -> cancel without a late hint', async function () {
        vi.useFakeTimers();
        try {
            const {options, onboardingController} = getData(undefined, 'onShowHint');
            const controller = new Controller({
                ...options,
                config: {...options.config, init: {initType: 'timeout', timeout: 3000}},
            });
            const showHint = vi.fn();
            onboardingController.events.subscribe('showHint', showHint);
            const appearance = onboardingController.stepElementReached({
                stepSlug: 'showCoolFeature',
                element: getAnchorElement(),
            });
            await vi.advanceTimersByTimeAsync(0);
            expect(controller.state.base.activeQueue).toEqual(['coolNewFeature']);

            const skipping = onboardingController.skipStep('showCoolFeature');
            await vi.advanceTimersByTimeAsync(3200);
            await Promise.all([appearance, skipping]);

            expect(controller.state.base.activePromo).toBe(null);
            expect(controller.state.base.activeQueue).toEqual([]);
            expect(controller.state.progress?.finishedPromos).toEqual([]);
            expect(controller.state.progress?.progressInfoByPromo.coolNewFeature).toBeDefined();
            expect(onboardingController.hintStore.state.open).toBe(false);
            expect(showHint).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });

    it('skip before promo progress is loaded -> save cancellation after loading', async function () {
        const {options, onboardingController} = getData();
        let resolveProgress!: (value: {finishedPromos: string[]; progressInfoByPromo: {}}) => void;
        const controller = new Controller({
            ...options,
            progressState: undefined,
            getProgressState: () =>
                new Promise((resolve) => {
                    resolveProgress = resolve;
                }),
        });
        const cancelPromo = vi.fn();
        controller.events.subscribe('cancelPromo', cancelPromo);
        await controller.ensureInit();

        const skipping = onboardingController.skipStep('showCoolFeature');
        await waitForNextTick();
        expect(cancelPromo).not.toHaveBeenCalled();
        resolveProgress({finishedPromos: [], progressInfoByPromo: {}});
        await skipping;
        await waitForNextTick();

        expect(controller.state.progress?.finishedPromos).toEqual([]);
        expect(controller.state.progress?.progressInfoByPromo.coolNewFeature).toBeDefined();
        expect(cancelPromo).toHaveBeenCalledOnce();
    });

    it('stale hint request for a skipped step -> keep the next step promo active', async function () {
        const {options, onboardingController} = getData(['showCoolFeature', 'followUpFeature']);
        const controller = new Controller(options);
        const finishPreset = vi.fn();
        onboardingController.events.subscribe('finishPreset', finishPreset);
        await controller.ensureInit();
        let releaseRequests!: () => void;
        const pendingRequests = new Promise<void>((resolve) => {
            releaseRequests = resolve;
        });
        let holdRequests = true;
        const requestStart = controller.requestStart;
        vi.spyOn(controller, 'requestStart').mockImplementation(async (preset) => {
            const result = await requestStart(preset);
            if (holdRequests) {
                await pendingRequests;
            }
            return result;
        });

        const appearance = onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });
        await waitForNextTick();
        expect(controller.state.base.activePromo).toBe('coolNewFeature');
        await onboardingController.skipStep('showCoolFeature');

        holdRequests = false;
        await onboardingController.stepElementReached({
            stepSlug: 'followUpFeature',
            element: getAnchorElement(),
        });
        expect(onboardingController.hintStore.state.hint?.step.slug).toBe('followUpFeature');

        releaseRequests();
        await appearance;
        await waitForNextTick();

        expect(controller.state.base.activePromo).toBe('coolNewFeature');
        expect(onboardingController.hintStore.state.open).toBe(true);
        expect(onboardingController.hintStore.state.hint?.step.slug).toBe('followUpFeature');
        expect(controller.state.progress?.progressInfoByPromo.coolNewFeature).toBeUndefined();

        await onboardingController.passStep('followUpFeature');
        expect(controller.state.progress?.finishedPromos).toEqual(['coolNewFeature']);
        expect(finishPreset).toHaveBeenCalledOnce();
    });

    it('reset and restart while skip awaits promo init -> ignore the previous result', async function () {
        vi.useFakeTimers();
        try {
            const {options, onboardingController} = getData();
            const controller = new Controller({
                ...options,
                config: {...options.config, init: {initType: 'timeout', timeout: 3000}},
            });
            const finishPromo = vi.fn();
            const cancelPromo = vi.fn();
            controller.events.subscribe('finishPromo', finishPromo);
            controller.events.subscribe('cancelPromo', cancelPromo);
            const ending = onboardingController.skipStep('showCoolFeature');
            await vi.advanceTimersByTimeAsync(0);
            expect(onboardingController.state.progress?.finishedPresets).toContain(
                'coolNewFeature',
            );

            const resetting = onboardingController.resetPresetProgress('coolNewFeature');
            await vi.advanceTimersByTimeAsync(200);
            await resetting;
            const restarting = onboardingController.runPreset('coolNewFeature');
            await vi.advanceTimersByTimeAsync(100);
            await restarting;

            await vi.advanceTimersByTimeAsync(3000);
            await ending;

            expect(controller.state.progress?.finishedPromos).toEqual([]);
            expect(controller.state.progress?.progressInfoByPromo).toEqual({});
            expect(onboardingController.state.progress?.finishedPresets).not.toContain(
                'coolNewFeature',
            );
            expect(onboardingController.state.base.activePresets).toContain('coolNewFeature');
            expect(finishPromo).not.toHaveBeenCalled();
            expect(cancelPromo).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });

    it.each(['pass', 'skip'] as const)(
        'reset a pending %s and skip the new run -> cancel once',
        async function (action) {
            vi.useFakeTimers();
            try {
                const {options, onboardingController} = getData();
                const controller = new Controller({
                    ...options,
                    config: {...options.config, init: {initType: 'timeout', timeout: 3000}},
                });
                const finishPromo = vi.fn();
                const cancelPromo = vi.fn();
                controller.events.subscribe('finishPromo', finishPromo);
                controller.events.subscribe('cancelPromo', cancelPromo);
                const ending =
                    action === 'pass'
                        ? onboardingController.passStep('showCoolFeature')
                        : onboardingController.skipStep('showCoolFeature');
                await vi.advanceTimersByTimeAsync(0);

                const resetting = onboardingController.resetPresetProgress('coolNewFeature');
                await vi.advanceTimersByTimeAsync(200);
                await resetting;
                const restarting = onboardingController.runPreset('coolNewFeature');
                await vi.advanceTimersByTimeAsync(100);
                await restarting;
                const skipping = onboardingController.skipStep('showCoolFeature');

                await vi.advanceTimersByTimeAsync(3000);
                await Promise.all([ending, skipping]);

                expect(controller.state.progress?.finishedPromos).toEqual([]);
                expect(controller.state.progress?.progressInfoByPromo.coolNewFeature).toBeDefined();
                expect(finishPromo).not.toHaveBeenCalled();
                expect(cancelPromo).toHaveBeenCalledOnce();
            } finally {
                vi.useRealTimers();
            }
        },
    );
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
