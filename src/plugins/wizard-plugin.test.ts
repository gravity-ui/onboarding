import {
    getAnchorElement,
    getOptions,
    getOptionsWithCombined,
    getOptionsWithPromo,
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
});

describe('open wizard', function () {
    it('onboarding disabled, wizard hidden -> load progress on open', async function () {
        const options = getOptions({enabled: false, wizardState: 'hidden'});
        options.plugins = [new WizardPlugin()];

        const controller = new Controller(options);

        await controller.setWizardState('visible');

        expect(options.getProgressState).toHaveBeenCalled();
    });

    it('onboarding enabled, wizard hidden -> load progress on open', async function () {
        const options = getOptions({wizardState: 'hidden'});
        options.plugins = [new WizardPlugin()];

        const controller = new Controller(options);

        await controller.setWizardState('visible');

        expect(options.getProgressState).toHaveBeenCalled();
    });
});

describe('close wizard', function () {
    it('remove progress for common preset', async function () {
        const options = getOptions({enabled: true, wizardState: 'visible'});
        options.plugins = [new WizardPlugin()];

        const controller = new Controller(options);
        await controller.setWizardState('hidden');

        expect(controller.state.base.activePresets).not.toContain('createProject');
        expect(controller.state.progress?.presetPassedSteps.createProjest).toBe(undefined);
    });

    it('remove progress for internal preset', async function () {
        const options = getOptionsWithCombined({enabled: true, wizardState: 'visible'});
        options.plugins = [new WizardPlugin()];

        const controller = new Controller(options);
        await controller.setWizardState('hidden');

        expect(controller.state.base.activePresets).not.toContain('internal1');
        expect(controller.state.progress?.presetPassedSteps.internal1).toBe(undefined);
    });

    it('dont remove progress for always hidden preset', async function () {
        const options = getOptions({enabled: true, wizardState: 'visible'});
        // @ts-ignore
        options.config.presets.createProject.visibility = 'alwaysHidden';
        options.plugins = [new WizardPlugin()];

        const controller = new Controller(options);
        await controller.setWizardState('hidden');

        expect(controller.state.base.activePresets).toContain('createProject');
        expect(controller.state.progress?.presetPassedSteps.createProject).toBeDefined();
    });

    it('turn off onboarding', async function () {
        const options = getOptions({wizardState: 'visible'});
        options.plugins = [new WizardPlugin()];

        const controller = new Controller(options);

        await controller.setWizardState('hidden');

        expect(controller.state.base.enabled).toBe(false);
    });

    it('close hint', async function () {
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

describe('run preset', function () {
    it('close hint', async function () {
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
});
