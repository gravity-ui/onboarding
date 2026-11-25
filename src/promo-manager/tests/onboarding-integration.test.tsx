import {Controller as OnboardingController} from '../../controller';
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

describe('temporary presets', () => {
    const getTemporaryData = ({
        beforeShowHint,
        autoPass = false,
        internal = false,
    }: {
        beforeShowHint?: () => Promise<boolean>;
        autoPass?: boolean;
        internal?: boolean;
    } = {}) => {
        const options = getOptionsWithPromo({
            wizardState: 'hidden',
            availablePresets: [],
            activePresets: [],
            suggestedPresets: [],
        });
        const preset = options.config.presets.coolNewFeature;
        const onboardingController = new OnboardingController({
            ...options,
            dateNow: () => new Date(Date.UTC(2025, 0, 1)),
            plugins: internal ? [] : options.plugins,
            hooks: {beforeShowHint},
            config: {
                presets: {
                    ...options.config.presets,
                    coolNewFeature: {
                        ...preset,
                        ...(internal ? {type: 'internal' as const} : {}),
                        persistence: 'temporary',
                        steps: autoPass
                            ? [{...preset.steps[0], passMode: 'onShowHint'}]
                            : [
                                  ...preset.steps,
                                  {slug: 'showSecondStep', name: '', description: ''},
                              ],
                    },
                },
            },
        });
        const controller = new Controller({
            ...testOptions,
            config: {
                promoGroups: [
                    {
                        slug: 'hintPromos',
                        promos: [
                            {slug: 'coolNewFeature', trigger: {on: 'enterPage'}},
                            {slug: 'nextPromo'},
                        ],
                    },
                ],
            },
            onboarding: {
                getInstance: () => onboardingController,
                groupSlug: 'hintPromos',
            },
            dateNow: () => Date.UTC(2025, 0, 1),
        });
        return {onboardingController, controller, onSave: options.onSave};
    };

    const startTemporaryPreset = async () => {
        const {onboardingController, controller} = getTemporaryData();

        await controller.ensureInit();
        await onboardingController.runPreset('coolNewFeature');
        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });
        expect(controller.getActivePromo()).toBe('coolNewFeature');
        expect(onboardingController.hintStore.state.open).toBe(true);
        expect(await controller.requestStart('nextPromo')).toBe(false);

        return {onboardingController, controller};
    };

    it('does not start a temporary promo from a configured trigger', async () => {
        const {controller} = getTemporaryData();

        await controller.ensureInit();
        await controller.sendEvent('enterPage');

        expect(controller.getActivePromo()).toBe(null);
        expect(controller.state.base.activeQueue).toEqual([]);
    });

    it('holds the promo slot between steps and releases it on completion', async () => {
        const {onboardingController, controller} = await startTemporaryPreset();

        await onboardingController.passStep('showCoolFeature');
        expect(controller.getActivePromo()).toBe('coolNewFeature');
        expect(controller.state.base.activeQueue).toEqual(['nextPromo']);

        await onboardingController.stepElementReached({
            stepSlug: 'showSecondStep',
            element: getAnchorElement(),
        });
        expect(onboardingController.hintStore.state.hint?.step.slug).toBe('showSecondStep');
        await onboardingController.passStep('showSecondStep');

        expect(controller.getActivePromo()).toBe('nextPromo');
        expect(controller.state.progress?.finishedPromos).toEqual(['coolNewFeature']);
    });

    it.each([false, true])(
        'preserves completion when a replay is cancelled, internal=%s',
        async (internal) => {
            const {onboardingController, controller} = getTemporaryData({internal});
            const saveProgress = vi.spyOn(controller, 'saveProgress');

            if (internal) {
                onboardingController.events.subscribe('beforeShowHint', ({stepData}) =>
                    controller.requestStart(stepData.preset),
                );
                onboardingController.events.subscribe('finishPreset', ({preset}) =>
                    controller.finishPromo(preset),
                );
                onboardingController.events.subscribe('cancelPreset', ({preset}) =>
                    controller.skipPromo(preset),
                );
            }

            await controller.ensureInit();
            const start = async () => {
                expect(await onboardingController.runPreset('coolNewFeature')).toBe(true);
                await onboardingController.stepElementReached({
                    stepSlug: 'showCoolFeature',
                    element: getAnchorElement(),
                });
                expect(onboardingController.hintStore.state.hint?.step.slug).toBe(
                    'showCoolFeature',
                );
                expect(controller.getActivePromo()).toBe('coolNewFeature');
            };

            await start();
            await onboardingController.passStep('showCoolFeature');
            await onboardingController.passStep('showSecondStep');
            expect(saveProgress).toHaveBeenCalledOnce();

            await start();
            await onboardingController.cancelPreset('coolNewFeature');

            expect(controller.getActivePromo()).toBeNull();
            expect(onboardingController.state.progress?.finishedPresets).toEqual([
                'coolNewFeature',
            ]);
            expect(controller.state.progress).toEqual({
                finishedPromos: ['coolNewFeature'],
                progressInfoByPromo: {
                    coolNewFeature: {lastCallTime: Date.UTC(2025, 0, 1)},
                },
            });
            expect(saveProgress).toHaveBeenCalledOnce();
        },
    );

    it('replays after loading saved promo completion', async () => {
        const {onboardingController, options} = getData();
        const preset = onboardingController.options.config.presets.coolNewFeature;

        if (preset.type !== 'combined') preset.persistence = 'temporary';

        const saved = {
            finishedPromos: ['coolNewFeature', 'coolNewFeature2'],
            progressInfoByPromo: {
                coolNewFeature: {lastCallTime: 1},
                coolNewFeature2: {lastCallTime: 2},
            },
        };
        const controller = new Controller({
            ...options,
            progressState: undefined,
            getProgressState: async () => saved,
        });
        expect(await onboardingController.runPreset('coolNewFeature')).toBe(true);
        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });

        expect(onboardingController.hintStore.state.hint?.step.slug).toBe('showCoolFeature');
        expect(controller.getActivePromo()).toBe('coolNewFeature');
        expect(controller.state.progress).toEqual(saved);
    });

    it('releases the promo slot without saving progress when cancelled between hints', async () => {
        const {onboardingController, controller} = await startTemporaryPreset();

        await onboardingController.passStep('showCoolFeature');
        expect(onboardingController.hintStore.state.open).toBe(false);
        expect(controller.getActivePromo()).toBe('coolNewFeature');

        await onboardingController.cancelPreset('coolNewFeature');

        expect(controller.getActivePromo()).toBe('nextPromo');
        expect(controller.state.progress?.finishedPromos).toEqual([]);
        expect(controller.state.progress?.progressInfoByPromo).toEqual({});
    });

    it.each(['dismissed', 'cancelled'] as const)(
        'saves completion while the final hint is visible and releases the slot when %s',
        async (action) => {
            const {onboardingController, controller, onSave} = getTemporaryData({
                autoPass: true,
            });
            const finished = vi.fn();

            onboardingController.events.subscribe('finishPreset', finished);
            await controller.ensureInit();
            await onboardingController.runPreset('coolNewFeature');
            await onboardingController.stepElementReached({
                stepSlug: 'showCoolFeature',
                element: getAnchorElement(),
            });
            expect(onSave.progress).toHaveBeenCalledWith({
                finishedPresets: ['coolNewFeature'],
                presetPassedSteps: {},
            });
            expect(onboardingController.hintStore.state.open).toBe(true);
            expect(finished).toHaveBeenCalledOnce();
            expect(controller.getActivePromo()).toBe('coolNewFeature');
            expect(await controller.requestStart('nextPromo')).toBe(false);
            expect(controller.state.base.activeQueue).toEqual(['nextPromo']);

            if (action === 'dismissed') {
                onboardingController.closeHintByUser('showCoolFeature');
            } else {
                await onboardingController.cancelPreset('coolNewFeature');
            }

            expect(onboardingController.hintStore.state.open).toBe(false);
            expect(finished).toHaveBeenCalledOnce();
            expect(controller.getActivePromo()).toBe('nextPromo');
            expect(controller.state.progress?.finishedPromos).toEqual(['coolNewFeature']);
        },
    );

    it('does not acquire the slot after an earlier hint hook outlives a cancelled run', async () => {
        let notifyHookStarted!: () => void;
        let resolveHook!: (allow: boolean) => void;
        const hookStarted = new Promise<void>((resolve) => {
            notifyHookStarted = resolve;
        });
        const hookResult = new Promise<boolean>((resolve) => {
            resolveHook = resolve;
        });
        const {onboardingController, controller} = getTemporaryData({
            beforeShowHint: () => {
                notifyHookStarted();
                return hookResult;
            },
        });

        await controller.ensureInit();
        await onboardingController.runPreset('coolNewFeature');
        const appearance = onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });
        await hookStarted;

        await onboardingController.cancelPreset('coolNewFeature');
        resolveHook(true);
        await appearance;

        expect(controller.getActivePromo()).toBe(null);
        expect(controller.state.base.activeQueue).toEqual([]);
        expect(onboardingController.hintStore.state.open).toBe(false);
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
