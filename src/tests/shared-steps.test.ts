import {getAnchorElement, getSameStepsOptions} from './utils';
import {Controller} from '../controller';
import {PresetStep} from '../types';

const addStepHookMocks = (step: PresetStep<any, any>) => {
    const onCloseHintByUserMock = jest.fn();
    const onCloseHintMock = jest.fn();
    const onStepPassMock = jest.fn();
    // eslint-disable-next-line no-param-reassign
    step.hooks = {
        onCloseHintByUser: onCloseHintByUserMock,
        onCloseHint: onCloseHintMock,
        onStepPass: onStepPassMock,
    };

    return {onCloseHintByUserMock, onCloseHintMock, onStepPassMock};
};

describe('show hint', () => {
    it('preset1 active -> take step from preset1', async () => {
        const options = getSameStepsOptions({
            availablePresets: ['preset1'],
            activePresets: ['preset1'],
            suggestedPresets: ['preset1'],
        });
        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'step1',
            element: getAnchorElement(),
        });
        expect(controller.hintStore.state.hint?.step.name).toBe('preset1step1');
    });

    it('preset2 active -> take step from preset2', async () => {
        const options = getSameStepsOptions({
            availablePresets: ['preset2'],
            activePresets: ['preset2'],
            suggestedPresets: ['preset2'],
        });
        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'step1',
            element: getAnchorElement(),
        });
        expect(controller.hintStore.state.hint?.step.name).toBe('preset2step1');
    });

    it('both presets available, preset1 active -> take step from preset1(active)', async () => {
        const options = getSameStepsOptions({
            availablePresets: ['preset1', 'preset2'],
            activePresets: ['preset1'],
            suggestedPresets: ['preset1', 'preset2'],
        });
        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'step1',
            element: getAnchorElement(),
        });
        expect(controller.hintStore.state.hint?.step.name).toBe('preset1step1');
    });

    it('both presets available, preset2 active -> take step from preset2(active)', async () => {
        const options = getSameStepsOptions({
            availablePresets: ['preset1', 'preset2'],
            activePresets: ['preset2'],
            suggestedPresets: ['preset1', 'preset2'],
        });
        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'step1',
            element: getAnchorElement(),
        });
        expect(controller.hintStore.state.hint?.step.name).toBe('preset2step1');
    });
});

describe('close hint hooks', () => {
    it('preset1 active -> take step from preset1', async () => {
        const options = getSameStepsOptions({
            availablePresets: ['preset1'],
            activePresets: ['preset1'],
            suggestedPresets: ['preset1'],
        });
        const {onCloseHintByUserMock, onCloseHintMock} = addStepHookMocks(
            options.config.presets.preset1.steps[0],
        );

        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'step1',
            element: getAnchorElement(),
        });
        controller.closeHintByUser('step1');

        expect(onCloseHintByUserMock).toHaveBeenCalled();
        expect(onCloseHintMock).toHaveBeenCalledWith({eventSource: 'closedByUser'});
    });

    it('preset2 active -> take step from preset2', async () => {
        const options = getSameStepsOptions({
            availablePresets: ['preset2'],
            activePresets: ['preset2'],
            suggestedPresets: ['preset2'],
        });
        const {onCloseHintByUserMock, onCloseHintMock} = addStepHookMocks(
            options.config.presets.preset2.steps[0],
        );

        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'step1',
            element: getAnchorElement(),
        });
        controller.closeHintByUser('step1');

        expect(onCloseHintByUserMock).toHaveBeenCalled();
        expect(onCloseHintMock).toHaveBeenCalledWith({eventSource: 'closedByUser'});
    });

    it('should both presets available, preset2 active -> take step from preset2(active)', async () => {
        const options = getSameStepsOptions({
            availablePresets: ['preset1', 'preset2'],
            activePresets: ['preset2'],
            suggestedPresets: ['preset1', 'preset2'],
        });
        const {onCloseHintByUserMock, onCloseHintMock} = addStepHookMocks(
            options.config.presets.preset2.steps[0],
        );

        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'step1',
            element: getAnchorElement(),
        });
        controller.closeHintByUser('step1');

        expect(onCloseHintByUserMock).toHaveBeenCalled();
        expect(onCloseHintMock).toHaveBeenCalledWith({eventSource: 'closedByUser'});
    });
});

describe('pass step hooks', () => {
    it('preset1 active -> take step from preset1', async () => {
        const options = getSameStepsOptions({
            availablePresets: ['preset1'],
            activePresets: ['preset1'],
            suggestedPresets: ['preset1'],
        });

        const {onStepPassMock} = addStepHookMocks(options.config.presets.preset1.steps[0]);

        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'step1',
            element: getAnchorElement(),
        });
        await controller.passStep('step1');

        expect(onStepPassMock).toHaveBeenCalled();
    });

    it('preset2 active -> take step from preset2', async () => {
        const options = getSameStepsOptions({
            availablePresets: ['preset2'],
            activePresets: ['preset2'],
            suggestedPresets: ['preset2'],
        });
        const {onStepPassMock} = addStepHookMocks(options.config.presets.preset2.steps[0]);

        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'step1',
            element: getAnchorElement(),
        });
        await controller.passStep('step1');

        expect(onStepPassMock).toHaveBeenCalled();
    });

    it('should both presets available, preset2 active -> take step from preset2(active)', async () => {
        const options = getSameStepsOptions({
            availablePresets: ['preset1', 'preset2'],
            activePresets: ['preset2'],
            suggestedPresets: ['preset1', 'preset2'],
        });
        const {onStepPassMock} = addStepHookMocks(options.config.presets.preset2.steps[0]);

        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'step1',
            element: getAnchorElement(),
        });
        await controller.passStep('step1');

        expect(onStepPassMock).toHaveBeenCalled();
    });
});

describe('pass step progress', () => {
    it('preset1 active -> write progress to preset1', async () => {
        const options = getSameStepsOptions({
            availablePresets: ['preset1'],
            activePresets: ['preset1'],
            suggestedPresets: ['preset1'],
        });

        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'step1',
            element: getAnchorElement(),
        });
        await controller.passStep('step1');

        expect(controller.state.progress?.presetPassedSteps.preset1).toContain('step1');
    });

    it('preset2 active -> take step from preset2', async () => {
        const options = getSameStepsOptions({
            availablePresets: ['preset2'],
            activePresets: ['preset2'],
            suggestedPresets: ['preset2'],
        });
        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'step1',
            element: getAnchorElement(),
        });
        await controller.passStep('step1');

        expect(controller.state.progress?.presetPassedSteps.preset2).toContain('step1');
    });

    it('should both presets available, preset2 active -> take step from preset2(active)', async () => {
        const options = getSameStepsOptions({
            availablePresets: ['preset1', 'preset2'],
            activePresets: ['preset2'],
            suggestedPresets: ['preset1', 'preset2'],
        });
        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'step1',
            element: getAnchorElement(),
        });
        await controller.passStep('step1');

        expect(controller.state.progress?.presetPassedSteps.preset2).toContain('step1');
    });
});
