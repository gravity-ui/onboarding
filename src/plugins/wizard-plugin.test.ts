import {getOptions, getOptionsWithCombined} from '../tests/utils';
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
});
