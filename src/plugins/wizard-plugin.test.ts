import {
    getAnchorElement,
    getOptions,
    getOptionsWithCombined,
    getOptionsWithPromo,
    waitForNextTick,
} from '../tests/utils';
import {Controller} from '../controller';
import {WizardPlugin} from './wizard-plugin';

describe('init', function () {
    it('init + wizard visible -> load progress', function () {
        const options = getOptions({wizardState: 'visible'});
        options.plugins = [new WizardPlugin()];

        // eslint-disable-next-line no-new
        new Controller(options);

        expect(options.getProgressState).toHaveBeenCalled();
    });

    it('init + wizard collapsed -> load progress', function () {
        const options = getOptions({wizardState: 'collapsed'});
        options.plugins = [new WizardPlugin()];

        // eslint-disable-next-line no-new
        new Controller(options);

        expect(options.getProgressState).toHaveBeenCalled();
    });

    it('onboardingInstance undefined -> return undefined', () => {
        const plugin = new WizardPlugin();
        const result = plugin.onInit();

        expect(result).toBeUndefined();
    });

    it('wizard visible + onboarding enabled -> keep onboarding disabled', () => {
        const options = getOptions();
        const plugin = new WizardPlugin();
        const controller = new Controller(options);

        plugin.onboardingInstance = controller;
        controller.state.base.wizardState = 'hidden';
        controller.state.base.enabled = false;

        plugin.onInit();

        expect(controller.state.base.enabled).toBe(false);
    });

    it('wizard hidden + onboarding disabled + baseState -> keep onboarding disabled', async () => {
        const options = getOptions();
        options.baseState = {
            wizardState: 'hidden',
            availablePresets: [],
            activePresets: [],
            suggestedPresets: [],
            enabled: false,
        };
        const plugin = new WizardPlugin();
        options.plugins = [plugin];

        const controller = new Controller(options);
        plugin.onboardingInstance = controller;

        plugin.onInit();

        expect(controller.state.base.enabled).toBe(false);
    });

    it('wizard visible + onboarding enabled -> keep onboarding enabled', async () => {
        const options = getOptions();
        options.baseState = {
            wizardState: 'visible',
            availablePresets: [],
            activePresets: [],
            suggestedPresets: [],
            enabled: true,
        };
        const plugin = new WizardPlugin();
        options.plugins = [plugin];

        const controller = new Controller(options);
        plugin.onboardingInstance = controller;

        plugin.onInit();

        expect(controller.state.base.enabled).toBe(true);
    });
});

describe('open wizard', function () {
    it('onboarding disabled, wizard hidden -> load progress on open', async function () {
        const options = getOptions({enabled: false, wizardState: 'hidden'});
        options.plugins = [new WizardPlugin()];

        const controller = new Controller(options);

        await controller.setWizardState('visible');

        expect(options.getProgressState).toHaveBeenCalled();
    });

    it('onboarding disabled, wizard hidden -> turn on onboarding', async function () {
        const options = getOptions({enabled: false, wizardState: 'hidden'});
        options.plugins = [new WizardPlugin()];

        const controller = new Controller(options);

        await controller.setWizardState('visible');

        expect(controller.state.base.enabled).toBe(true);
    });

    it('onboarding disabled, wizard hidden -> can show hint', async function () {
        const options = getOptions({enabled: false, wizardState: 'hidden'});
        options.plugins = [new WizardPlugin()];

        const controller = new Controller(options);

        await controller.stepElementReached({
            stepSlug: 'createSprint',
            element: getAnchorElement(),
        });
        await controller.setWizardState('visible');

        expect(controller.hintStore.state.open).toBe(true);
    });

    it('onboarding enabled, wizard hidden -> load progress on open', async function () {
        const options = getOptions({wizardState: 'hidden'});
        options.plugins = [new WizardPlugin()];

        const controller = new Controller(options);

        await controller.setWizardState('visible');

        expect(options.getProgressState).toHaveBeenCalled();
    });

    it('onboardingInstance undefined -> return undefined', async () => {
        const plugin = new WizardPlugin();
        const result = await plugin.onWizardStateChanged({wizardState: 'visible'} as any);

        expect(result).toBeUndefined();
    });

    describe('repair state', () => {
        it('onboarding disabled, wizard visible -> load progress', async function () {
            const options = getOptions({enabled: false, wizardState: 'visible'});
            options.plugins = [new WizardPlugin()];

            // eslint-disable-next-line no-new
            new Controller(options);

            await waitForNextTick();

            expect(options.getProgressState).toHaveBeenCalled();
        });

        it('onboarding disabled, wizard visible -> enable onboarding', async function () {
            const options = getOptions({enabled: false, wizardState: 'visible'});
            options.plugins = [new WizardPlugin()];

            const controller = new Controller(options);

            await waitForNextTick();
            await waitForNextTick();

            expect(controller.state.base.enabled).toBe(true);
        });
    });
});

describe('close wizard', function () {
    it('wizard visible -> remove progress for common preset', async function () {
        const options = getOptions({enabled: true, wizardState: 'visible'});
        options.plugins = [new WizardPlugin()];

        const controller = new Controller(options);
        await controller.setWizardState('hidden');

        expect(controller.state.base.activePresets).not.toContain('createProject');
        expect(controller.state.progress?.presetPassedSteps.createProjest).toBe(undefined);
    });

    it('wizard visible -> remove progress for internal preset', async function () {
        const options = getOptionsWithCombined({enabled: true, wizardState: 'visible'});
        options.plugins = [new WizardPlugin()];

        const controller = new Controller(options);
        await controller.setWizardState('hidden');

        expect(controller.state.base.activePresets).not.toContain('internal1');
        expect(controller.state.progress?.presetPassedSteps.internal1).toBe(undefined);
    });

    it('wizard visible + always hidden preset -> dont remove progress', async function () {
        const options = getOptions({enabled: true, wizardState: 'visible'});
        // @ts-ignore
        options.config.presets.createProject.visibility = 'alwaysHidden';
        options.plugins = [new WizardPlugin()];

        const controller = new Controller(options);
        await controller.setWizardState('hidden');

        expect(controller.state.base.activePresets).toContain('createProject');
        expect(controller.state.progress?.presetPassedSteps.createProject).toBeDefined();
    });

    it('wizard visible -> turn off onboarding', async function () {
        const options = getOptions({wizardState: 'visible'});
        options.plugins = [new WizardPlugin()];

        const controller = new Controller(options);

        await controller.setWizardState('hidden');

        expect(controller.state.base.enabled).toBe(false);
    });

    it('wizard visible + hint open -> close hint', async function () {
        const options = getOptions();
        options.plugins = [new WizardPlugin()];
        const controller = new Controller(options);

        await controller.stepElementReached({
            stepSlug: 'createSprint',
            element: getAnchorElement(),
        });

        await controller.setWizardState('hidden');

        expect(controller.hintStore.state.open).toBe(false);
    });
});

describe('eraseCommonPresetsProgress', function () {
    it('onboardingInstance undefined -> return undefined', async () => {
        const plugin = new WizardPlugin();
        const result = await plugin['eraseCommonPresetsProgress']();

        expect(result).toBeUndefined();
    });

    it('non-existent presets in activePresets -> dont remove', async () => {
        const options = getOptions();
        const plugin = new WizardPlugin();
        options.plugins = [plugin];
        const controller = new Controller(options);

        controller.state.base.activePresets = ['nonExistentPreset'];
        plugin.onboardingInstance = controller;

        await plugin['eraseCommonPresetsProgress']();

        expect(controller.state.base.activePresets).toEqual(['nonExistentPreset']);
    });
});

describe('run preset', function () {
    it('hint open -> close hint', async function () {
        const options = getOptions();
        options.plugins = [new WizardPlugin()];
        const controller = new Controller(options);

        await controller.stepElementReached({
            stepSlug: 'createSprint',
            element: getAnchorElement(),
        });

        await controller.runPreset('createQueue');

        expect(controller.hintStore.state.open).toBe(false);
    });

    it('run same preset -> reset progress', async function () {
        const options = getOptions();
        options.plugins = [new WizardPlugin()];
        const controller = new Controller(options);

        await controller.stepElementReached({
            stepSlug: 'createSprint',
            element: getAnchorElement(),
        });

        await controller.runPreset('createProject');

        expect(controller.state.progress?.presetPassedSteps.createProject).toBe(undefined);
    });

    it('has deletedPreset in progress -> reset progress', async function () {
        const options = getOptions(
            {
                activePresets: ['createProject', 'deletedPreset'],
            },
            {
                presetPassedSteps: {
                    createProject: ['openBoard'],
                    deletedPreset: ['someStep'],
                },
            },
        );
        options.plugins = [new WizardPlugin()];
        const controller = new Controller(options);

        await controller.runPreset('createQueue');

        expect(controller.state.progress?.presetPassedSteps.createProject).toBe(undefined);
    });

    it('rerun common preset -> reset progress', async function () {
        const options = getOptions(
            {activePresets: []},
            {
                finishedPresets: ['createProject'],
            },
        );
        options.plugins = [new WizardPlugin()];
        const controller = new Controller(options);
        await controller.ensureRunning();

        await controller.runPreset('createProject');

        expect(controller.state.progress?.presetPassedSteps.createProject).toBe(undefined);
    });

    it('rerun combined preset -> reset progress', async function () {
        const options = getOptionsWithCombined(
            {activePresets: []},
            {
                presetPassedSteps: {internal1: ['someStepInternal11']},
                finishedPresets: ['internal1'],
            },
        );
        options.plugins = [new WizardPlugin()];
        const controller = new Controller(options);
        await controller.ensureRunning();

        await controller.runPreset('combinedPreset');

        expect(controller.state.progress?.presetPassedSteps.internal1).toBe(undefined);
    });

    it('run always hidden preset -> NOT reset progress', async function () {
        const options = getOptions();
        options.plugins = [new WizardPlugin()];
        // @ts-ignore
        options.config.presets.createQueue.visibility = 'alwaysHidden';
        const controller = new Controller(options);

        await controller.stepElementReached({
            stepSlug: 'createSprint',
            element: getAnchorElement(),
        });

        await controller.runPreset('createQueue');

        expect(controller.state.progress?.presetPassedSteps.createProject).not.toBe(undefined);
    });

    it('onboardingInstance undefined -> return undefined', async () => {
        const plugin = new WizardPlugin();
        const result = await plugin.onRunPreset({preset: 'testPreset'} as any);

        expect(result).toBeUndefined();
    });
});

describe('finish preset', function () {
    it('finish common preset -> show wizard', async function () {
        const options = getOptionsWithPromo({wizardState: 'collapsed'});
        options.plugins = [new WizardPlugin()];

        const controller = new Controller(options);
        await controller.finishPreset('createProject');

        expect(controller.state.base.wizardState).toBe('visible');
    });

    it('finish always hidden preset -> nothing', async function () {
        const options = getOptionsWithPromo({wizardState: 'collapsed'});
        options.plugins = [new WizardPlugin()];

        const controller = new Controller(options);
        await controller.finishPreset('coolNewFeature');

        expect(controller.state.base.wizardState).toBe('collapsed');
    });

    it('onboardingInstance undefined -> return undefined', () => {
        const plugin = new WizardPlugin();
        const result = plugin.onFinishPreset({preset: 'testPreset'} as any);

        expect(result).toBeUndefined();
    });
});
