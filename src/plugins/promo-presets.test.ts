import {getAnchorElement, getOptionsWithPromo, waitForNextTick} from '../tests/utils';
import {Controller} from '../controller';
import {PromoPresetsPlugin} from './promo-presets';

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

        it('guide visible -> show hint', async function () {
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
        it('onboarding disabled and default options -> enable onboarding', async function () {
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

        it('onboardingInstance is undefined -> return undefined', () => {
            const plugin = new PromoPresetsPlugin();
            const result = plugin.onSuggestPreset({preset: 'testPreset'} as any);

            expect(result).toBeUndefined();
        });

        it('turnOnWhenSuggestPromoPreset = false and onboarding enabled -> stay enabled', () => {
            const options = getOptionsWithPromo();
            const plugin = new PromoPresetsPlugin({turnOnWhenSuggestPromoPreset: false});
            const controller = new Controller(options);

            plugin.onboardingInstance = controller;
            controller.state.base.enabled = false;

            plugin.onSuggestPreset({preset: 'testPreset'} as any);

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

            it('onboardingInstance is undefined -> return true', () => {
                const plugin = new PromoPresetsPlugin();
                const result = plugin.onElementReach({
                    stepData: {
                        preset: 'testPreset',
                        step: {slug: 'testStep'},
                    },
                } as any);

                expect(result).toBe(true);
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

    describe('checkIsPromoPreset', function () {
        it('onboardingInstance is undefined -> return false', () => {
            const plugin = new PromoPresetsPlugin();
            const result = plugin['checkIsPromoPreset']('testPreset');

            expect(result).toBe(false);
        });

        it('non-existent preset -> return false', async () => {
            const options = getOptionsWithPromo();
            const controller = new Controller(options);
            const plugin = new PromoPresetsPlugin();
            plugin.onboardingInstance = controller;

            const result = plugin['checkIsPromoPreset']('nonExistentPreset');

            expect(result).toBe(false);
        });

        it('preset with type internal -> return false', async () => {
            const options = getOptionsWithPromo();
            // Add internal preset to config
            (options.config.presets as any).internalPreset = {
                type: 'internal',
                visibility: 'alwaysHidden',
                steps: [],
            };

            const controller = new Controller(options);
            const plugin = new PromoPresetsPlugin();
            plugin.onboardingInstance = controller;

            const result = plugin['checkIsPromoPreset']('internalPreset');

            expect(result).toBe(false);
        });
    });

    describe('wizard state changes', function () {
        it('open wizard -> close promo hint', async function () {
            const options = getOptionsWithPromo();
            options.plugins = [new PromoPresetsPlugin()];
            const controller = new Controller(options);

            await controller.stepElementReached({
                stepSlug: 'showCoolFeature',
                element: getAnchorElement(),
            });

            await controller.setWizardState('visible');

            expect(controller.hintStore.state.open).toBe(false);
        });

        it('open wizard -> NOT close common hint', async function () {
            const options = getOptionsWithPromo();
            options.plugins = [new PromoPresetsPlugin()];
            const controller = new Controller(options);

            await controller.stepElementReached({
                stepSlug: 'openBoard',
                element: getAnchorElement(),
            });

            await controller.setWizardState('visible');

            expect(controller.hintStore.state.open).toBe(true);
        });

        it('onboardingInstance is undefined -> return undefined', async () => {
            const plugin = new PromoPresetsPlugin();
            const result = await plugin.onWizardStateChanged({wizardState: 'visible'} as any);

            expect(result).toBeUndefined();
        });

        it('hint is not open -> do nothing', async () => {
            const options = getOptionsWithPromo();
            const controller = new Controller(options);
            const plugin = new PromoPresetsPlugin();
            plugin.onboardingInstance = controller;

            await plugin.onWizardStateChanged({wizardState: 'visible'} as any);

            // Should not throw error when no hint is open
            expect(controller.hintStore.state.open).toBe(false);
        });
    });

    describe('constructor options', function () {
        it('custom options -> set custom values', () => {
            const plugin = new PromoPresetsPlugin({
                turnOnWhenShowHint: false,
                turnOnWhenSuggestPromoPreset: false,
            });

            expect(plugin.options.turnOnWhenShowHint).toBe(false);
            expect(plugin.options.turnOnWhenSuggestPromoPreset).toBe(false);
        });

        it('default options -> set default values', () => {
            const plugin = new PromoPresetsPlugin();

            expect(plugin.options.turnOnWhenShowHint).toBe(true);
            expect(plugin.options.turnOnWhenSuggestPromoPreset).toBe(true);
        });
    });
});
