import {BaseState, OnboardingPlugin, PresetStep} from '../types';
import {getAnchorElement, waitForNextTick} from '../tests/utils';
import {Controller} from '../controller';
import {PromoPresetsPlugin} from './promo-presets';

export const getOptionsWithPromo = (baseState: Partial<BaseState> = {}) => {
    return {
        config: {
            presets: {
                createProject: {
                    name: 'Creating project',
                    steps: [
                        {
                            slug: 'openBoard',
                            name: '',
                            description: '',
                        },
                    ] as Array<PresetStep<string, {}>>,
                },
                coolNewFeature: {
                    name: 'Cool feature',
                    visibility: 'alwaysHidden' as const,
                    steps: [
                        {
                            slug: 'showCoolFeature',
                            name: '',
                            description: '',
                        },
                    ] as Array<PresetStep<string, {}>>,
                },
                coolNewFeature2: {
                    name: 'Cool feature2',
                    visibility: 'alwaysHidden' as const,
                    steps: [
                        {
                            slug: 'showCoolFeature2',
                            name: '',
                            description: '',
                        },
                    ] as Array<PresetStep<string, {}>>,
                },
            },
        },
        baseState: {
            wizardState: 'visible' as const,
            availablePresets: ['createProject', 'coolNewFeature'],
            activePresets: ['createProject', 'coolNewFeature'],
            suggestedPresets: ['createProject', 'coolNewFeature'],
            enabled: true,
            ...baseState,
        },
        getProgressState: async () => ({}),
        onSave: {
            state: jest.fn(),
            progress: jest.fn(),
        },
        logger: {
            level: 'error' as const,
            logger: {
                log: () => {},
                error: () => {},
            },
        },
        plugins: [new PromoPresetsPlugin()] as OnboardingPlugin[],
    };
};

describe('common preset', function () {
    describe('show hint', function () {
        it('guide collapsed -> show hint', async function () {
            const options = getOptionsWithPromo({wizardState: 'collapsed'});

            const controller = new Controller(options);
            await controller.stepElementReached({
                stepSlug: 'openBoard',
                element: getAnchorElement(),
            });

            expect(controller.hintStore.state.open).toBe(true);
        });

        it('guide visible ->  show hint', async function () {
            const options = getOptionsWithPromo({wizardState: 'visible'});

            const controller = new Controller(options);
            await controller.stepElementReached({
                stepSlug: 'openBoard',
                element: getAnchorElement(),
            });

            expect(controller.hintStore.state.open).toBe(true);
        });

        it('guide invisible -> dont show hint', async function () {
            const options = getOptionsWithPromo({wizardState: 'invisible'});

            const controller = new Controller(options);
            await controller.stepElementReached({
                stepSlug: 'openBoard',
                element: getAnchorElement(),
            });

            expect(controller.hintStore.state.open).toBe(false);
        });

        it('guide hidden -> dont show hint', async function () {
            const options = getOptionsWithPromo({wizardState: 'hidden'});

            const controller = new Controller(options);
            await controller.stepElementReached({
                stepSlug: 'openBoard',
                element: getAnchorElement(),
            });

            expect(controller.hintStore.state.open).toBe(false);
        });
    });
});

describe('promo preset', function () {
    describe('suggest preset', function () {
        it('onboarding disabled and default options -> go to invisible state', async function () {
            const options = getOptionsWithPromo({enabled: false});

            const controller = new Controller(options);
            await controller.suggestPresetOnce('coolNewFeature2');

            await waitForNextTick();

            expect(controller.state.base.suggestedPresets).toContain('coolNewFeature2');
            expect(controller.state.base.enabled).toBe(true);
        });
        it('turnOnWhenSuggestPromoPreset = false -> stay not enabled', async function () {
            const options = getOptionsWithPromo({enabled: false});
            options.plugins = [new PromoPresetsPlugin({turnOnWhenSuggestPromoPreset: false})];

            const controller = new Controller(options);
            await controller.suggestPresetOnce('coolNewFeature2');

            await waitForNextTick();

            expect(controller.state.base.suggestedPresets).toContain('coolNewFeature2');
            expect(controller.state.base.enabled).toBe(false);
        });
    });

    describe('show hint', function () {
        describe('onboarding enabled', function () {
            it('guide collapsed -> dont show hint', async function () {
                const options = getOptionsWithPromo({wizardState: 'collapsed'});

                const controller = new Controller(options);
                await controller.stepElementReached({
                    stepSlug: 'showCoolFeature',
                    element: getAnchorElement(),
                });

                expect(controller.hintStore.state.open).toBe(false);
            });

            it('guide visible -> dont show hint', async function () {
                const options = getOptionsWithPromo({wizardState: 'visible'});

                const controller = new Controller(options);
                await controller.stepElementReached({
                    stepSlug: 'showCoolFeature',
                    element: getAnchorElement(),
                });

                expect(controller.hintStore.state.open).toBe(false);
            });

            it('guide invisible -> show hint', async function () {
                const options = getOptionsWithPromo({wizardState: 'invisible'});

                const controller = new Controller(options);
                await controller.stepElementReached({
                    stepSlug: 'showCoolFeature',
                    element: getAnchorElement(),
                });

                expect(controller.hintStore.state.open).toBe(true);
            });

            it('guide hidden -> show hint', async function () {
                const options = getOptionsWithPromo({wizardState: 'hidden'});

                const controller = new Controller(options);
                await controller.stepElementReached({
                    stepSlug: 'showCoolFeature',
                    element: getAnchorElement(),
                });

                expect(controller.hintStore.state.open).toBe(true);
            });
        });

        describe('onboarding disabled', function () {
            it('onboarding disabled, guide invisible -> turn on, show hint', async function () {
                const options = getOptionsWithPromo({wizardState: 'invisible', enabled: false});

                const controller = new Controller(options);
                await controller.stepElementReached({
                    stepSlug: 'showCoolFeature',
                    element: getAnchorElement(),
                });

                expect(controller.hintStore.state.open).toBe(true);
                expect(controller.state.base.enabled).toBe(true);
            });

            it('onboarding disabled, guide hidden -> turn on, show hint', async function () {
                const options = getOptionsWithPromo({wizardState: 'hidden', enabled: false});

                const controller = new Controller(options);
                await controller.stepElementReached({
                    stepSlug: 'showCoolFeature',
                    element: getAnchorElement(),
                });

                expect(controller.hintStore.state.open).toBe(true);
                expect(controller.state.base.enabled).toBe(true);
            });

            it('guide hidden + turnOnWhenShowHint = false -> dont show hint, stay disabled', async function () {
                const options = getOptionsWithPromo({wizardState: 'hidden', enabled: false});
                options.plugins = [new PromoPresetsPlugin({turnOnWhenShowHint: false})];

                const controller = new Controller(options);
                await controller.stepElementReached({
                    stepSlug: 'showCoolFeature',
                    element: getAnchorElement(),
                });

                expect(controller.hintStore.state.open).toBe(false);
                expect(controller.state.base.enabled).toBe(false);
                expect(controller.state.base.wizardState).toBe('hidden');
            });
        });
    });
});
