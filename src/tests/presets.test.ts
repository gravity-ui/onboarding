import {Controller} from '../controller';
import {getOptions} from './utils';

describe('preset management', function () {
    it('add preset -> save base state', async function () {
        const options = getOptions();

        const controller = new Controller(options);
        await controller.addPreset('createQueue');

        const newState = options.onSave.state.mock.calls[0][0];

        expect(newState.activePresets).toEqual(['createProject', 'createQueue']);
        expect(newState.suggestedPresets).toEqual(['createProject', 'createQueue']);
    });

    it('add same preset -> not duplicate', async function () {
        const options = getOptions();

        const controller = new Controller(options);
        await controller.addPreset('createQueue');
        await controller.addPreset('createQueue');

        const newState =
            options.onSave.state.mock.calls[options.onSave.state.mock.calls.length - 1][0];

        expect(newState.activePresets).toEqual(['createProject', 'createQueue']);
    });

    it('preset not from config -> nothing', async function () {
        const options = getOptions();

        const controller = new Controller(options);
        // @ts-ignore
        await controller.addPreset('createQueue123');

        expect(options.onSave.state).not.toHaveBeenCalled();
        expect(options.onSave.progress).not.toHaveBeenCalled();
    });

    it('finish preset -> add to finished', async function () {
        const options = getOptions();

        const controller = new Controller(options);
        await controller.finishPreset('createProject');

        const newBaseState = options.onSave.state.mock.calls[0][0];
        const newProgressState = options.onSave.progress.mock.calls[0][0];

        expect(newBaseState.activePresets).toEqual([]);
        expect(newProgressState.finishedPresets).toEqual(['createProject']);
    });

    it('finish same preset -> not duplicate', async function () {
        const options = getOptions();

        const controller = new Controller(options);
        await controller.finishPreset('createProject');
        await controller.finishPreset('createProject');

        const newProgressState = options.onSave.progress.mock.calls[1][0];

        expect(newProgressState.finishedPresets).toEqual(['createProject']);
    });

    it('finish preset -> stay in suggested', async function () {
        const options = getOptions();

        const controller = new Controller(options);
        await controller.finishPreset('createProject');

        const newBaseState = options.onSave.state.mock.calls[0][0];

        expect(newBaseState.suggestedPresets).toEqual(['createProject']);
    });

    it('reset preset -> remove progress, remove from finished', async function () {
        const options = getOptions({}, {finishedPresets: ['createQueue']});

        const controller = new Controller(options);
        await controller.resetPresetProgress(['createProject', 'createQueue']);

        const newProgressState = options.onSave.progress.mock.calls[0][0];

        // remove createQueue from finished
        expect(newProgressState.finishedPresets).toEqual([]);

        // remove createProject passed steps
        expect(newProgressState.presetPassedSteps.createProject).toEqual([]);

        const newBaseState = options.onSave.state.mock.calls[0][0];
        // remove createProject from suggested presets
        expect(newBaseState.suggestedPresets).toEqual([]);
    });
});

describe('suggest once', function () {
    it('first preset run -> runs', async function () {
        const options = getOptions({wizardState: 'hidden'});

        const controller = new Controller(options);
        await controller.suggestPresetOnce('createQueue');

        const newState = options.onSave.state.mock.calls[0][0];

        expect(newState.wizardState).toBe('visible');
    });

    it('call -> add preset', async function () {
        const options = getOptions();

        const controller = new Controller(options);
        await controller.suggestPresetOnce('createQueue');

        const newState = options.onSave.state.mock.calls[0][0];

        expect(newState.activePresets).toEqual(['createProject', 'createQueue']);
    });

    it('second run -> nothing', async function () {
        const options = getOptions({wizardState: 'hidden'});

        const controller = new Controller(options);
        await controller.suggestPresetOnce('createQueue');
        await controller.setWizardState('hidden');

        await controller.suggestPresetOnce('createQueue');

        expect(controller.state.base.wizardState).toBe('hidden');
    });
});
