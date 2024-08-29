import {Controller as OnboardingController} from '../../controller';
import {Controller} from '../core/controller';
import {testOptions} from './options';
import {getAnchorElement, getOptionsWithPromo} from '../../tests/utils';

it('no group -> error', async function () {
    const onboardingController = new OnboardingController(getOptionsWithPromo());

    const errorLoggerMock = jest.fn();

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
                debug: jest.fn(),
            },
        },
    });

    await controller.ensureInit();

    expect(errorLoggerMock).toHaveBeenCalled();
});

it('adds promos for every "alwaysHidden" preset', async function () {
    const onboardingController = new OnboardingController(getOptionsWithPromo());

    const controller = new Controller({
        ...testOptions,
        config: {
            promoGroups: [
                {
                    slug: 'hintPromos',
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

it('reach element -> activate promo', async function () {
    const onboardingController = new OnboardingController(
        getOptionsWithPromo({wizardState: 'hidden'}),
    );

    const controller = new Controller({
        ...testOptions,
        config: {
            promoGroups: [
                {
                    slug: 'hintPromos',
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

    await expect(controller.state.base.activePromo).toBe('coolNewFeature');
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

it('pass preset -> finish promo', async function () {
    const onboardingController = new OnboardingController(
        getOptionsWithPromo({wizardState: 'hidden'}),
    );

    const controller = new Controller({
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
    });

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
    const onboardingController = new OnboardingController(
        getOptionsWithPromo({wizardState: 'hidden'}),
    );

    const controller = new Controller({
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
    });

    await controller.ensureInit();

    await onboardingController.stepElementReached({
        stepSlug: 'showCoolFeature',
        element: getAnchorElement(),
    });
    await onboardingController.stepElementDisappeared('showCoolFeature');

    expect(controller.state.base.activePromo).toBe(null);
    expect(controller.state.progress?.finishedPromos).not.toContain('coolNewFeature');
});

it('reset progress -> erase onboarding presets', async function () {
    const onboardingController = new OnboardingController(
        getOptionsWithPromo({wizardState: 'hidden'}),
    );

    const controller = new Controller({
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
    });

    await controller.resetToDefaultState();

    expect(onboardingController.state.base.activePresets).toEqual(['createProject']);
    expect(onboardingController.state.base.suggestedPresets).toEqual(['createProject']);

    expect(onboardingController.state.progress).toEqual({
        finishedPresets: [],
        presetPassedSteps: {},
    });
});
