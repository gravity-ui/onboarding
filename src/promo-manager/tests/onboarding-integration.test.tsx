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

    it('reset promoManager -> clear active promo and queue', async function () {
        const {options, onboardingController} = getData();
        const controller = new Controller(options);

        await controller.ensureInit();
        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });
        expect(controller.state.base.activePromo).toBe('coolNewFeature');

        await controller.resetToDefaultState();

        expect(controller.state.base.activePromo).toBe(null);
        expect(controller.state.base.activeQueue).toEqual([]);
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

        await controller.requestStart('coolNewFeature');
        expect(controller.state.base.activePromo).toBe('coolNewFeature');

        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });
        expect(onboardingController.hintStore.state.open).toBe(true);

        onboardingController.closeHintByUser();
        await waitForNextTick();

        expect(controller.state.base.activePromo).toBe('coolNewFeature');
    });

    it('finishPreset releases the promo slot', async function () {
        const {onboardingController, options} = getPresetModeData();
        const controller = new Controller(options);
        await controller.ensureInit();

        await controller.requestStart('coolNewFeature');
        expect(controller.state.base.activePromo).toBe('coolNewFeature');

        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });
        expect(onboardingController.hintStore.state.open).toBe(true);

        await onboardingController.passStep('showCoolFeature');
        await waitForNextTick();

        expect(controller.state.base.activePromo).toBe(null);
        expect(controller.state.progress?.finishedPromos).toContain('coolNewFeature');
    });

    it('hints suppressed when promo slot is held by another promo', async function () {
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

        await controller.requestStart('otherPromo');
        expect(controller.state.base.activePromo).toBe('otherPromo');

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

        await controller.requestStart('coolNewFeature');
        expect(controller.state.base.activePromo).toBe('coolNewFeature');

        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });
        expect(onboardingController.hintStore.state.open).toBe(true);

        onboardingController.closeHintByUser();
        await waitForNextTick();
        controller.cancelPromo('coolNewFeature');
        await waitForNextTick();

        expect(controller.state.base.activePromo).toBe(null);

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

        await controller.requestStart('otherPromo');

        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature2',
            element: getAnchorElement(),
        });

        expect(onboardingController.state.base.suggestedPresets).not.toContain('coolNewFeature2');
        expect(onboardingController.hintStore.state.open).toBe(false);
    });

    it('alwaysHidden preset without declared promo is vetoed and never suggested', async function () {
        const {onboardingController, options} = getPresetModeData();
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

        await controller.requestStart('multiStepFeature');
        expect(controller.state.base.activePromo).toBe('multiStepFeature');

        await onboardingController.stepElementReached({
            stepSlug: 'stepOne',
            element: getAnchorElement(),
        });
        expect(onboardingController.hintStore.state.open).toBe(true);
        expect(onboardingController.hintStore.state.hint?.step.slug).toBe('stepOne');

        await onboardingController.passStep('stepOne');
        await waitForNextTick();
        expect(controller.state.base.activePromo).toBe('multiStepFeature');

        controller.reinitialize({keepActive: true});
        await waitForNextTick();
        expect(controller.state.base.activePromo).toBe('multiStepFeature');

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
        const controller = new Controller(options);
        await controller.ensureInit();

        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });

        expect(controller.state.base.activePromo).toBe('coolNewFeature');
        expect(onboardingController.hintStore.state.open).toBe(true);

        onboardingController.closeHintByUser();
        await waitForNextTick();

        expect(controller.state.base.activePromo).toBe(null);
    });
});

describe('preset mode reload continuation and suggest lifecycle', function () {
    it('preset restored from persisted onboarding state continues after a reload', async function () {
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
                availablePresets: ['promoFeature'],
                activePresets: ['promoFeature'],
                suggestedPresets: ['promoFeature'],
                enabled: true,
            },
            getProgressState: async () => ({}),
            onSave: {state: vi.fn(), progress: vi.fn()},
            logger: {
                level: 'error' as const,
                logger: {debug: () => {}, error: () => {}},
            },
        });

        const controller = new Controller({
            ...testOptions,
            config: {
                promoGroups: [
                    {slug: 'hintPromos', conditions: [], promos: [{slug: 'promoFeature'}]},
                ],
                init: {initType: 'event' as const, timeout: 3000, event: 'ready'},
            },
            onboarding: {
                getInstance: () => onboardingController,
                groupSlug: 'hintPromos',
                mode: 'preset' as const,
            },
        });

        await controller.sendEvent('ready');
        await controller.ensureInit();

        expect(controller.state.base.activePromo).toBe(null);

        await onboardingController.stepElementReached({
            stepSlug: 'showPromoFeature',
            element: getAnchorElement(),
        });

        expect(controller.state.base.activePromo).toBe('promoFeature');
        expect(onboardingController.hintStore.state.open).toBe(true);
        expect(onboardingController.hintStore.state.hint?.step.slug).toBe('showPromoFeature');
    });

    it('refused suggest does not leave a ghost in the promo queue', async function () {
        const {onboardingController, options} = getSuggestRetryData([
            {slug: 'otherPromos', conditions: [], promos: [{slug: 'otherPromo'}]},
            {slug: 'hintPromos', conditions: [], promos: [{slug: 'promoFeature'}]},
        ]);
        const controller = new Controller(options);

        await controller.sendEvent('ready');
        await controller.ensureInit();

        await controller.requestStart('otherPromo');
        expect(controller.state.base.activePromo).toBe('otherPromo');

        const suggested = await onboardingController.suggestPresetOnce('promoFeature');
        expect(suggested).toBe(false);
        expect(onboardingController.state.base.suggestedPresets).not.toContain('promoFeature');
        expect(controller.state.base.activeQueue).not.toContain('promoFeature');

        await controller.finishPromo('otherPromo');
        await waitForNextTick();

        expect(controller.state.base.activePromo).toBe(null);
    });

    it('product veto after a won slot releases the slot', async function () {
        const {onboardingController, options} = getSuggestRetryData([
            {slug: 'hintPromos', conditions: [], promos: [{slug: 'promoFeature'}]},
        ]);
        const controller = new Controller(options);

        await controller.sendEvent('ready');
        await controller.ensureInit();

        onboardingController.events.subscribe('beforeSuggestPreset', () => false);

        const suggested = await onboardingController.suggestPresetOnce('promoFeature');
        expect(suggested).toBe(false);

        expect(controller.state.base.activePromo).toBe(null);
        expect(controller.state.base.activeQueue).toEqual([]);
        expect(onboardingController.state.base.activePresets).not.toContain('promoFeature');
        expect(onboardingController.state.base.suggestedPresets).not.toContain('promoFeature');
    });

    it('a later legitimate suggest runs after a refused suggest', async function () {
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

        const refused = await onboardingController.suggestPresetOnce('promoFeature');
        expect(refused).toBe(false);
        expect(controller.state.base.activeQueue).toEqual([]);
        expect(onboardingController.state.base.suggestedPresets).not.toContain('promoFeature');

        featureAllowed = true;
        const suggested = await onboardingController.suggestPresetOnce('promoFeature');

        expect(suggested).toBe(true);
        expect(controller.state.base.activePromo).toBe('promoFeature');
        expect(onboardingController.state.base.suggestedPresets).toContain('promoFeature');
        expect(onboardingController.state.base.activePresets).toContain('promoFeature');
    });

    it('gate cycles never re-suggest a vetoed preset', async function () {
        const {onboardingController, options} = getSuggestRetryData([
            {slug: 'otherPromos', conditions: [], promos: [{slug: 'otherPromo'}]},
            {slug: 'hintPromos', conditions: [], promos: [{slug: 'promoFeature'}]},
        ]);
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

    it('a never-run promo preset with a reached element does not enter the promo queue', async function () {
        const {onboardingController, options} = getSuggestRetryData([
            {slug: 'hintPromos', conditions: [], promos: [{slug: 'promoFeature'}]},
        ]);
        const controller = new Controller(options);

        await controller.sendEvent('ready');
        await controller.ensureInit();

        await onboardingController.stepElementReached({
            stepSlug: 'showPromoFeature',
            element: getAnchorElement(),
        });

        expect(controller.state.base.activeQueue).toEqual([]);
        expect(controller.state.base.activePromo).toBe(null);
        expect(onboardingController.hintStore.state.open).toBe(false);
    });
});
