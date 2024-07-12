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
