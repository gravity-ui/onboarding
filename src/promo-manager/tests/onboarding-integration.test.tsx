import {Controller as OnboardingController} from '../../controller';
import {Controller} from '../core/controller';
import {testOptions} from './options';
import {getAnchorElement, getOptionsWithPromo} from '../../tests/utils';
import {waitForNextTick} from './utils';
import {PromoPresetsPlugin} from '../../plugins/promo-presets';
import type {OnboardingIntegrationOptions, PromoOptions} from '../core/types';

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

const getPresetModeData = () => {
    const onboardingController = new OnboardingController({
        config: {
            presets: {
                coolNewFeature: {
                    name: 'Cool feature',
                    visibility: 'alwaysHidden' as const,
                    steps: [{slug: 'showCoolFeature', name: '', description: ''}],
                },
                coolNewFeature2: {
                    name: 'Cool feature 2',
                    visibility: 'alwaysHidden' as const,
                    steps: [{slug: 'showCoolFeature2', name: '', description: ''}],
                },
            },
        },
        baseState: {
            wizardState: 'hidden' as const,
            availablePresets: ['coolNewFeature', 'coolNewFeature2'],
            activePresets: ['coolNewFeature', 'coolNewFeature2'],
            suggestedPresets: [],
            enabled: true,
        },
        getProgressState: async () => ({}),
        onSave: {state: vi.fn(), progress: vi.fn()},
        logger: {
            level: 'error' as const,
            logger: {debug: () => {}, error: () => {}},
        },
        plugins: [new PromoPresetsPlugin()],
    });

    const options = {
        ...testOptions,
        config: {
            promoGroups: [
                {
                    slug: 'hintPromos',
                    conditions: [],
                    promos: [
                        {slug: 'coolNewFeature', conditions: []},
                        {slug: 'coolNewFeature2', conditions: []},
                    ],
                },
            ],
        },
        onboarding: {
            getInstance: () => onboardingController,
            groupSlug: 'hintPromos',
            mode: 'preset' as const,
        },
    };

    return {onboardingController, options};
};

const getSuggestRetryData = (
    promoGroups: PromoOptions['config']['promoGroups'],
    integrationOverrides: Partial<OnboardingIntegrationOptions> = {},
) => {
    const onboardingController = new OnboardingController({
        config: {
            presets: {
                promoFeature: {
                    name: 'Promo feature',
                    visibility: 'alwaysHidden' as const,
                    steps: [{slug: 'showPromoFeature', name: '', description: ''}],
                },
            },
        },
        baseState: {
            wizardState: 'hidden' as const,
            availablePresets: [],
            activePresets: [],
            suggestedPresets: [],
            enabled: true,
        },
        getProgressState: async () => ({}),
        onSave: {state: vi.fn(), progress: vi.fn()},
        logger: {
            level: 'error' as const,
            logger: {debug: () => {}, error: () => {}},
        },
    });

    const options = {
        ...testOptions,
        config: {
            promoGroups,
            init: {initType: 'event' as const, timeout: 3000, event: 'ready'},
        },
        onboarding: {
            getInstance: () => onboardingController,
            groupSlug: 'hintPromos',
            mode: 'preset' as const,
            ...integrationOverrides,
        },
    };

    return {onboardingController, options};
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

describe('preset mode', function () {
    it('slot held across all steps — closing the hint does not release it', async function () {
        const {onboardingController, options} = getPresetModeData();
        const controller = new Controller(options);
        await controller.ensureInit();

        // In preset mode, the promo slot must be acquired BEFORE the hint step fires.
        // beforeShowHint only checks ownership; it does not requestStart.
        await controller.requestStart('coolNewFeature');
        expect(controller.state.base.activePromo).toBe('coolNewFeature');

        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });
        expect(onboardingController.hintStore.state.open).toBe(true);

        // Close the hint (simulates user dismissal without finishing the preset).
        onboardingController.closeHintByUser();
        await waitForNextTick();

        // Promo slot must still be held — closeHint is not subscribed in preset mode.
        expect(controller.state.base.activePromo).toBe('coolNewFeature');
    });

    it('finishPreset releases the promo slot', async function () {
        const {onboardingController, options} = getPresetModeData();
        const controller = new Controller(options);
        await controller.ensureInit();

        // Acquire promo slot first (preset-mode requirement).
        await controller.requestStart('coolNewFeature');
        expect(controller.state.base.activePromo).toBe('coolNewFeature');

        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });
        expect(onboardingController.hintStore.state.open).toBe(true);

        // Finishing the preset should release and finish the promo.
        await onboardingController.passStep('showCoolFeature');
        await waitForNextTick();

        expect(controller.state.base.activePromo).toBe(null);
        expect(controller.state.progress?.finishedPromos).toContain('coolNewFeature');
    });

    it('hints suppressed when promo slot is held by another promo', async function () {
        const {onboardingController, options} = getPresetModeData();
        // Add a competing promo group so we can hold the slot externally.
        const controller = new Controller({
            ...options,
            config: {
                promoGroups: [
                    {slug: 'otherPromos', conditions: [], promos: [{slug: 'otherPromo'}]},
                    {slug: 'hintPromos', conditions: [], promos: []},
                ],
            },
        });
        await controller.ensureInit();

        // Take the slot with an unrelated promo.
        await controller.requestStart('otherPromo');
        expect(controller.state.base.activePromo).toBe('otherPromo');

        // Trying to show a hint for coolNewFeature should be blocked —
        // beforeShowHint returns false because otherPromo, not coolNewFeature,
        // holds the active slot.
        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });

        expect(onboardingController.hintStore.state.open).toBe(false);
    });

    it('consumer-driven cancelPromo stops subsequent hints', async function () {
        const {onboardingController, options} = getPresetModeData();
        const controller = new Controller(options);
        await controller.ensureInit();

        // Acquire promo slot first.
        await controller.requestStart('coolNewFeature');
        expect(controller.state.base.activePromo).toBe('coolNewFeature');

        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });
        expect(onboardingController.hintStore.state.open).toBe(true);

        // Simulate consumer closing the hint and cancelling via step hook.
        onboardingController.closeHintByUser();
        await waitForNextTick();
        controller.cancelPromo('coolNewFeature');
        await waitForNextTick();

        expect(controller.state.base.activePromo).toBe(null);

        // Reaching the step again should not show the hint (quota recorded by cancelPromo).
        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });
        expect(onboardingController.hintStore.state.open).toBe(false);
    });

    it('beforeSuggestPreset vetoed when another promo holds the slot', async function () {
        const {onboardingController, options} = getPresetModeData();
        const controller = new Controller({
            ...options,
            config: {
                promoGroups: [
                    {slug: 'otherPromos', conditions: [], promos: [{slug: 'otherPromo'}]},
                    {slug: 'hintPromos', conditions: [], promos: []},
                ],
            },
        });
        await controller.ensureInit();

        // Hold the slot with an unrelated promo.
        await controller.requestStart('otherPromo');

        // Suggest coolNewFeature2 — its beforeSuggestPreset should be vetoed.
        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature2',
            element: getAnchorElement(),
        });

        // The preset must not have been added to suggestedPresets.
        expect(onboardingController.state.base.suggestedPresets).not.toContain('coolNewFeature2');
        expect(onboardingController.hintStore.state.open).toBe(false);
    });

    it('alwaysHidden preset without declared promo is vetoed and never suggested', async function () {
        const {onboardingController, options} = getPresetModeData();
        // Strip the promo declarations — the preset exists only in the onboarding config.
        const controller = new Controller({
            ...options,
            config: {
                promoGroups: [{slug: 'hintPromos', conditions: [], promos: []}],
            },
        });
        await controller.ensureInit();

        const result = await onboardingController.suggestPresetOnce('coolNewFeature2');

        expect(result).toBe(false);
        expect(onboardingController.state.base.suggestedPresets).not.toContain('coolNewFeature2');
        expect(controller.state.base.activePromo).toBe(null);

        // A reached hint anchor stays suppressed too: the preset never acquired the promo slot.
        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature2',
            element: getAnchorElement(),
        });
        expect(onboardingController.hintStore.state.open).toBe(false);
    });

    it('presets split across two groups with independent conditions', async function () {
        const onboardingController = new OnboardingController({
            config: {
                presets: {
                    featureA: {
                        name: 'Feature A',
                        visibility: 'alwaysHidden' as const,
                        steps: [{slug: 'stepA', name: '', description: ''}],
                    },
                    featureB: {
                        name: 'Feature B',
                        visibility: 'alwaysHidden' as const,
                        steps: [{slug: 'stepB', name: '', description: ''}],
                    },
                },
            },
            baseState: {
                wizardState: 'hidden' as const,
                availablePresets: ['featureA', 'featureB'],
                activePresets: ['featureA', 'featureB'],
                suggestedPresets: [],
                enabled: true,
            },
            getProgressState: async () => ({}),
            onSave: {state: vi.fn(), progress: vi.fn()},
            logger: {
                level: 'error' as const,
                logger: {debug: () => {}, error: () => {}},
            },
            plugins: [new PromoPresetsPlugin()],
        });

        const conditionAAllowed = vi.fn().mockReturnValue(true);
        const conditionBAllowed = vi.fn().mockReturnValue(true);

        // Pre-declare each preset in its target group — config-derived routing:
        // the controller reads the existing promos array to determine which group
        // each alwaysHidden preset should be injected into. No resolveGroup needed.
        const controller = new Controller({
            ...testOptions,
            config: {
                promoGroups: [
                    {
                        slug: 'groupA',
                        conditions: [conditionAAllowed],
                        promos: [{slug: 'featureA', conditions: []}],
                    },
                    {
                        slug: 'groupB',
                        conditions: [conditionBAllowed],
                        promos: [{slug: 'featureB', conditions: []}],
                    },
                ],
            },
            onboarding: {
                getInstance: () => onboardingController,
                groupSlug: ['groupA', 'groupB'],
                mode: 'preset',
            },
        });

        await controller.ensureInit();

        // featureA is in groupA, featureB is in groupB — declared in the config.
        const groups = controller.options.config.promoGroups.filter(
            (g) => g.slug === 'groupA' || g.slug === 'groupB',
        );
        expect(groups).toHaveLength(2);
        const [groupA, groupB] = groups;
        expect(groupA?.promos.map((p) => p.slug)).toContain('featureA');
        expect(groupB?.promos.map((p) => p.slug)).toContain('featureB');
    });

    it('reinitialize({keepActive: true}) keeps an in-progress multi-step preset alive', async function () {
        const onboardingController = new OnboardingController({
            config: {
                presets: {
                    multiStepFeature: {
                        name: 'Multi-step feature',
                        visibility: 'alwaysHidden' as const,
                        steps: [
                            {slug: 'stepOne', name: '', description: ''},
                            {slug: 'stepTwo', name: '', description: ''},
                        ],
                    },
                },
            },
            baseState: {
                wizardState: 'hidden' as const,
                availablePresets: ['multiStepFeature'],
                activePresets: ['multiStepFeature'],
                suggestedPresets: [],
                enabled: true,
            },
            getProgressState: async () => ({}),
            onSave: {state: vi.fn(), progress: vi.fn()},
            logger: {
                level: 'error' as const,
                logger: {debug: () => {}, error: () => {}},
            },
            plugins: [new PromoPresetsPlugin()],
        });

        const controller = new Controller({
            ...testOptions,
            config: {
                promoGroups: [
                    {
                        slug: 'hintPromos',
                        conditions: [],
                        promos: [{slug: 'multiStepFeature', conditions: []}],
                    },
                ],
            },
            onboarding: {
                getInstance: () => onboardingController,
                groupSlug: 'hintPromos',
                mode: 'preset',
            },
        });
        await controller.ensureInit();

        // Acquire the promo slot (as beforeSuggestPreset would).
        await controller.requestStart('multiStepFeature');
        expect(controller.state.base.activePromo).toBe('multiStepFeature');

        await onboardingController.stepElementReached({
            stepSlug: 'stepOne',
            element: getAnchorElement(),
        });
        expect(onboardingController.hintStore.state.open).toBe(true);
        expect(onboardingController.hintStore.state.hint?.step.slug).toBe('stepOne');

        // Pass step one — the preset continues to step two, slot still held.
        await onboardingController.passStep('stepOne');
        await waitForNextTick();
        expect(controller.state.base.activePromo).toBe('multiStepFeature');

        // Re-arm the gate while keeping the active promo.
        controller.reinitialize({keepActive: true});
        await waitForNextTick();
        expect(controller.state.base.activePromo).toBe('multiStepFeature');

        // Step two's hint still shows — the preset did not lose its slot.
        await onboardingController.stepElementReached({
            stepSlug: 'stepTwo',
            element: getAnchorElement(),
        });
        expect(onboardingController.hintStore.state.open).toBe(true);
        expect(onboardingController.hintStore.state.hint?.step.slug).toBe('stepTwo');
    });
});

describe('hint mode (default) regression', function () {
    it('hint mode is unchanged when mode option is omitted', async function () {
        const {options, onboardingController} = getData();
        // Explicitly no `mode` field → defaults to 'hint'.
        const controller = new Controller(options);
        await controller.ensureInit();

        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });

        expect(controller.state.base.activePromo).toBe('coolNewFeature');
        expect(onboardingController.hintStore.state.open).toBe(true);

        // In hint mode, closing the hint releases the promo slot.
        onboardingController.closeHintByUser();
        await waitForNextTick();

        expect(controller.state.base.activePromo).toBe(null);
    });
});

describe('preset mode suggest retry', function () {
    it('lost-slot veto is retried and recovers after reinitialize + readiness event', async function () {
        const {onboardingController, options} = getSuggestRetryData([
            {slug: 'otherPromos', conditions: [], promos: [{slug: 'otherPromo'}]},
            {slug: 'hintPromos', conditions: [], promos: [{slug: 'promoFeature'}]},
        ]);
        const controller = new Controller(options);

        // Open gate #1.
        await controller.sendEvent('ready');
        await controller.ensureInit();

        // Hold the slot with an unrelated promo.
        await controller.requestStart('otherPromo');
        expect(controller.state.base.activePromo).toBe('otherPromo');

        // Suggest — vetoed because the slot is taken; the slug stays queued.
        const suggested = await onboardingController.suggestPresetOnce('promoFeature');
        expect(suggested).toBe(false);
        expect(onboardingController.state.base.suggestedPresets).not.toContain('promoFeature');
        expect(controller.state.base.activeQueue).toContain('promoFeature');

        // Context change re-arms the gate; the readiness event opens it again.
        controller.reinitialize();
        await controller.sendEvent('ready');
        await waitForNextTick();

        // The drain re-suggested the preset; the slot was won from the queue.
        expect(controller.state.base.activePromo).toBe('promoFeature');
        expect(onboardingController.state.base.suggestedPresets).toContain('promoFeature');
        expect(onboardingController.state.base.activePresets).toContain('promoFeature');

        // Hints render — the read-only beforeShowHint gate passes now.
        await onboardingController.stepElementReached({
            stepSlug: 'showPromoFeature',
            element: getAnchorElement(),
        });
        expect(onboardingController.hintStore.state.open).toBe(true);
        expect(onboardingController.hintStore.state.hint?.step.slug).toBe('showPromoFeature');
    });

    it('not-able-to-run veto recovers when conditions flip; stays pending otherwise', async function () {
        let featureAllowed = false;
        const {onboardingController, options} = getSuggestRetryData([
            {
                slug: 'hintPromos',
                conditions: [() => featureAllowed],
                promos: [{slug: 'promoFeature'}],
            },
        ]);
        const controller = new Controller(options);

        await controller.sendEvent('ready');
        await controller.ensureInit();

        // Conditions fail — vetoed before enqueue.
        const suggested = await onboardingController.suggestPresetOnce('promoFeature');
        expect(suggested).toBe(false);
        expect(onboardingController.state.base.suggestedPresets).not.toContain('promoFeature');
        expect(controller.state.base.activeQueue).toEqual([]);

        // Still not able — exactly one retry per gate cycle, entry stays pending.
        controller.reinitialize();
        await controller.sendEvent('ready');
        await waitForNextTick();
        expect(onboardingController.state.base.suggestedPresets).not.toContain('promoFeature');
        expect(controller.state.base.activePromo).toBe(null);

        // Conditions flip — the next gate cycle recovers.
        featureAllowed = true;
        controller.reinitialize();
        await controller.sendEvent('ready');
        await waitForNextTick();

        expect(controller.state.base.activePromo).toBe('promoFeature');
        expect(onboardingController.state.base.suggestedPresets).toContain('promoFeature');
    });

    it('product veto (requestStart succeeded) is not retried', async function () {
        const {onboardingController, options} = getSuggestRetryData([
            {slug: 'hintPromos', conditions: [], promos: [{slug: 'promoFeature'}]},
        ]);
        const controller = new Controller(options);

        await controller.sendEvent('ready');
        await controller.ensureInit();

        // The product vetoes while the integration's requestStart succeeds.
        onboardingController.events.subscribe('beforeSuggestPreset', () => false);

        const suggested = await onboardingController.suggestPresetOnce('promoFeature');
        expect(suggested).toBe(false);
        // requestStart won the slot even though the suggest was vetoed.
        expect(controller.state.base.activePromo).toBe('promoFeature');

        // Gate cycle: no retry — the product's veto is final.
        controller.reinitialize();
        await controller.sendEvent('ready');
        await waitForNextTick();

        expect(onboardingController.state.base.suggestedPresets).not.toContain('promoFeature');
        expect(onboardingController.state.base.activePresets).not.toContain('promoFeature');
    });

    it('product veto on the retry is final — no re-record, no further retries', async function () {
        const {onboardingController, options} = getSuggestRetryData([
            {slug: 'otherPromos', conditions: [], promos: [{slug: 'otherPromo'}]},
            {slug: 'hintPromos', conditions: [], promos: [{slug: 'promoFeature'}]},
        ]);
        const controller = new Controller(options);

        await controller.sendEvent('ready');
        await controller.ensureInit();
        await controller.requestStart('otherPromo');

        // Integration-caused veto — recorded for retry.
        await onboardingController.suggestPresetOnce('promoFeature');
        expect(onboardingController.state.base.suggestedPresets).not.toContain('promoFeature');

        // The product starts vetoing before the retry lands.
        onboardingController.events.subscribe('beforeSuggestPreset', () => false);

        controller.reinitialize();
        await controller.sendEvent('ready');
        await waitForNextTick();

        // The retry ran, the product vetoed it — requestStart had succeeded,
        // so the entry was not re-recorded.
        expect(onboardingController.state.base.suggestedPresets).not.toContain('promoFeature');
        expect(onboardingController.state.base.activePresets).not.toContain('promoFeature');

        // A further gate cycle does not retry again.
        controller.reinitialize();
        await controller.sendEvent('ready');
        await waitForNextTick();
        expect(onboardingController.state.base.suggestedPresets).not.toContain('promoFeature');
    });

    it('timeout fallback opens the gate and drains pending suggests', async function () {
        vi.useFakeTimers();
        try {
            const {onboardingController, options} = getSuggestRetryData([
                {slug: 'otherPromos', conditions: [], promos: [{slug: 'otherPromo'}]},
                {slug: 'hintPromos', conditions: [], promos: [{slug: 'promoFeature'}]},
            ]);
            const controller = new Controller(options);

            // Gate #1 via the readiness event.
            await controller.sendEvent('ready');
            await controller.ensureInit();
            await controller.requestStart('otherPromo');
            await onboardingController.suggestPresetOnce('promoFeature');
            expect(onboardingController.state.base.suggestedPresets).not.toContain('promoFeature');

            // Re-arm; let the timeout fallback open gate #2 — no event sent.
            controller.reinitialize();
            await vi.advanceTimersByTimeAsync(3000);
            await vi.advanceTimersByTimeAsync(0);

            expect(controller.state.base.activePromo).toBe('promoFeature');
            expect(onboardingController.state.base.suggestedPresets).toContain('promoFeature');
        } finally {
            vi.useRealTimers();
        }
    });

    it('stale pending entry is a harmless no-op after a direct runPreset', async function () {
        const {onboardingController, options} = getSuggestRetryData([
            {slug: 'otherPromos', conditions: [], promos: [{slug: 'otherPromo'}]},
            {slug: 'hintPromos', conditions: [], promos: [{slug: 'promoFeature'}]},
        ]);
        const controller = new Controller(options);

        await controller.sendEvent('ready');
        await controller.ensureInit();
        await controller.requestStart('otherPromo');

        // Integration-caused veto — recorded.
        await onboardingController.suggestPresetOnce('promoFeature');
        expect(onboardingController.state.base.suggestedPresets).not.toContain('promoFeature');

        // The consumer runs the preset directly — bypasses beforeSuggestPreset,
        // so the pending entry goes stale.
        await controller.finishPromo('otherPromo');
        await onboardingController.runPreset('promoFeature');
        expect(onboardingController.state.base.suggestedPresets).toContain('promoFeature');

        const runPresetSpy = vi.fn();
        onboardingController.events.subscribe('runPreset', runPresetSpy);

        // Gate cycle: the drain hits the once-guard, drops the entry, no re-run.
        controller.reinitialize();
        await controller.sendEvent('ready');
        await waitForNextTick();

        expect(runPresetSpy).not.toHaveBeenCalled();
        expect(onboardingController.state.base.suggestedPresets).toEqual(['promoFeature']);
    });

    it('context flip after a lost-slot veto: retry vetoed, once-guard not burned, later cycle recovers', async function () {
        let pageAllowed = true;
        const {onboardingController, options} = getSuggestRetryData([
            {slug: 'otherPromos', conditions: [], promos: [{slug: 'otherPromo'}]},
            {
                slug: 'hintPromos',
                conditions: [() => pageAllowed],
                promos: [{slug: 'promoFeature'}],
            },
        ]);
        const controller = new Controller(options);

        await controller.sendEvent('ready');
        await controller.ensureInit();
        await controller.requestStart('otherPromo');

        // Lost-slot veto while the page context still allows the feature.
        await onboardingController.suggestPresetOnce('promoFeature');
        expect(controller.state.base.activeQueue).toContain('promoFeature');

        // Page context changes — the feature is no longer eligible.
        pageAllowed = false;
        controller.reinitialize();
        await controller.sendEvent('ready');
        await waitForNextTick();

        // The retry was vetoed by the fresh condition check; nothing ran or burned.
        expect(onboardingController.state.base.suggestedPresets).toEqual([]);
        expect(onboardingController.state.base.activePresets).not.toContain('promoFeature');
        expect(controller.state.base.activePromo).toBe(null);

        // Context returns — the standing retry recovers on the next cycle.
        pageAllowed = true;
        controller.reinitialize();
        await controller.sendEvent('ready');
        await waitForNextTick();

        expect(controller.state.base.activePromo).toBe('promoFeature');
        expect(onboardingController.state.base.suggestedPresets).toContain('promoFeature');
    });

    it('shouldRetrySuggest=false drops the pending entry without re-suggesting', async function () {
        const {onboardingController, options} = getSuggestRetryData(
            [
                {slug: 'otherPromos', conditions: [], promos: [{slug: 'otherPromo'}]},
                {slug: 'hintPromos', conditions: [], promos: [{slug: 'promoFeature'}]},
            ],
            {shouldRetrySuggest: () => false},
        );
        const controller = new Controller(options);

        await controller.sendEvent('ready');
        await controller.ensureInit();
        await controller.requestStart('otherPromo');

        await onboardingController.suggestPresetOnce('promoFeature');
        expect(onboardingController.state.base.suggestedPresets).not.toContain('promoFeature');

        const suggestSpy = vi.spyOn(onboardingController, 'suggestPresetOnce');

        controller.reinitialize();
        await controller.sendEvent('ready');
        await waitForNextTick();

        expect(suggestSpy).not.toHaveBeenCalled();
        expect(onboardingController.state.base.suggestedPresets).not.toContain('promoFeature');
        suggestSpy.mockRestore();
    });
});
