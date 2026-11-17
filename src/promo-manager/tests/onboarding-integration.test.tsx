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

describe('async preset resolution', function () {
    const asyncPresetBody = {
        name: 'Async hidden feature',
        visibility: 'alwaysHidden' as const,
        steps: [{slug: 'showAsyncFeature', name: '', description: ''}],
    };

    const getAsyncData = (opts?: {loader?: () => Promise<any>}) => {
        const loader = vi.fn(opts?.loader ?? (() => Promise.resolve(asyncPresetBody)));

        const onboardingBase = getOptionsWithPromo({
            wizardState: 'hidden',
            availablePresets: ['createProject', 'coolNewFeature', 'asyncHiddenFeature'],
            activePresets: ['createProject', 'coolNewFeature', 'asyncHiddenFeature'],
        });

        const onboardingController = new OnboardingController({
            ...onboardingBase,
            config: {
                ...onboardingBase.config,
                presets: {
                    ...onboardingBase.config.presets,
                    asyncHiddenFeature: {
                        type: 'lazy' as const,
                        name: 'Async hidden feature',
                        visibility: 'alwaysHidden' as const,
                        steps: ['showAsyncFeature'],
                        load: loader,
                    },
                },
            },
        } as any);

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

        return {onboardingController, options, loader};
    };

    it('lazy preset is auto-injected as a promo on init without loading its body', async function () {
        const {options, loader} = getAsyncData();
        const controller = new Controller(options);

        await controller.ensureInit();

        // The lazy-backed promo is auto-discovered and injected — no explicit declaration needed
        const {promos} = controller.options.config.promoGroups[0];
        expect(promos).toEqual([
            {slug: 'coolNewFeature', conditions: []},
            {slug: 'coolNewFeature2', conditions: []},
            {slug: 'asyncHiddenFeature', conditions: []},
        ]);

        // Nothing is loaded at init
        expect(loader).not.toHaveBeenCalled();
    });

    it('requestStart activates the lazy-backed promo and loads the body on demand', async function () {
        const {options, loader} = getAsyncData();
        const controller = new Controller(options);

        await controller.ensureInit();
        expect(loader).not.toHaveBeenCalled();

        const started = await controller.requestStart('asyncHiddenFeature');

        expect(started).toBe(true);
        expect(controller.state.base.activePromo).toBe('asyncHiddenFeature');

        // Activation triggered the on-demand load of exactly this preset's body
        await waitForNextTick();
        expect(loader).toHaveBeenCalledTimes(1);
        expect(
            (controller.options.onboarding?.getInstance() as any).options.config.presets
                .asyncHiddenFeature,
        ).toEqual(asyncPresetBody);
    });

    it('reaching the lazy preset step shows its hint after the promo activates', async function () {
        const {options, onboardingController} = getAsyncData();
        const controller = new Controller(options);

        await controller.ensureInit();

        // Element reached before the preset body is loaded — recorded, but no hint yet
        await onboardingController.stepElementReached({
            stepSlug: 'showAsyncFeature',
            element: getAnchorElement(),
        });
        expect(onboardingController.hintStore.state.open).toBe(false);

        // Promo start activates the promo, loads the preset body on demand,
        // and re-checks reached hints — now the hint can show
        await controller.requestStart('asyncHiddenFeature');
        await waitForNextTick();

        expect(controller.state.base.activePromo).toBe('asyncHiddenFeature');
        expect(onboardingController.hintStore.state.open).toBe(true);
        expect(onboardingController.hintStore.state.hint?.step.slug).toBe('showAsyncFeature');
    });

    it('loader is called exactly once across repeated activations', async function () {
        const {options, loader} = getAsyncData();
        const controller = new Controller(options);

        await controller.ensureInit();
        await controller.requestStart('asyncHiddenFeature');
        await waitForNextTick();
        await controller.requestStart('asyncHiddenFeature');
        await waitForNextTick();

        expect(loader).toHaveBeenCalledTimes(1);
    });

    it('loader failure is logged and no hint is shown', async function () {
        const {options, onboardingController} = getAsyncData({
            loader: () => Promise.reject(new Error('offline')),
        });
        const controller = new Controller(options);

        await controller.ensureInit();
        await controller.requestStart('asyncHiddenFeature');
        await waitForNextTick();

        // Loader failed — the promo stays active but no hint is shown, no crash
        expect(controller.state.base.activePromo).toBe('asyncHiddenFeature');
        expect(onboardingController.hintStore.state.open).toBe(false);
    });
});
