import {getOptions} from './utils';
import {Controller} from '../controller';

it('show wizard -> save base state', async function () {
    const options = getOptions({wizardState: 'hidden'});

    const controller = new Controller(options);
    await controller.setWizardState('visible');

    const newState = options.onSave.state.mock.calls[0][0];

    expect(newState.wizardState).toBe('visible');
});

it('hide wizard -> save base state', async function () {
    const options = getOptions();

    const controller = new Controller(options);
    await controller.setWizardState('hidden');

    const newState = options.onSave.state.mock.calls[0][0];

    expect(newState.wizardState).toBe('hidden');
});

it('should have hidden wizard by default', async function () {
    const options = getOptions();
    // @ts-ignore
    options.baseState = undefined;

    const controller = new Controller(options);
    expect(controller.state.base.wizardState).toBe('hidden');
});

it('change style -> save', async function () {
    const options = getOptions();

    const controller = new Controller(options);
    await controller.setWizardState('hidden');

    const newState = options.onSave.state.mock.calls[0][0];

    expect(newState.wizardState).toBe('hidden');
});
