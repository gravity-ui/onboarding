import {Controller} from '../controller';
import {getAnchorElement, getOptions, getOptionsWithHooks} from './utils';

describe('hooks', function () {
    it('reachElement -> onShowHint called', async function () {
        const options = getOptionsWithHooks();
        const controller = new Controller(options);

        await controller.stepElementReached({
            stepSlug: 'createSprint',
            element: getAnchorElement(),
        });

        expect(options.hooks.onShowHint).toHaveBeenCalledWith({
            preset: 'createProject',
            step: 'createSprint',
        });
    });

    it('reachElement on NOT active preset -> NOT calls onShowHint', async function () {
        const options = getOptionsWithHooks({activePresets: []});
        const controller = new Controller(options);

        await controller.stepElementReached({
            stepSlug: 'createSprint',
            element: getAnchorElement(),
        });

        expect(options.hooks.onShowHint).not.toHaveBeenCalled();
    });

    it('reachElement on passed step -> NOT calls onShowHint', async function () {
        const options = getOptionsWithHooks();

        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'createIssue',
            element: getAnchorElement(),
        });

        expect(options.hooks.onShowHint).not.toHaveBeenCalled();
    });

    it('pass step on active preset -> calls onPassStep', async function () {
        const options = getOptionsWithHooks();

        const controller = new Controller(options);
        await controller.passStep('createSprint');

        expect(options.hooks.onStepPass).toHaveBeenCalledWith({
            preset: 'createProject',
            step: 'createSprint',
        });
    });

    it('pass step on NOT active preset -> NOT calls onPassStep', async function () {
        const options = getOptionsWithHooks({activePresets: []});

        const controller = new Controller(options);
        await controller.passStep('createSprint');

        expect(options.hooks.onStepPass).not.toHaveBeenCalled();
    });

    it('finish preset by pass step -> calls onFinishPreset', async function () {
        const options = getOptionsWithHooks(
            {},
            {presetPassedSteps: {createProject: ['openBoard', 'createSprint']}},
        );

        const controller = new Controller(options);
        await controller.passStep('createIssue');

        expect(options.hooks.onFinishPreset).toHaveBeenCalledWith({
            preset: 'createProject',
        });
    });

    it('force finish preset -> calls onFinishPreset', async function () {
        const options = getOptionsWithHooks();

        const controller = new Controller(options);
        await controller.finishPreset('createProject');

        expect(options.hooks.onFinishPreset).toHaveBeenCalledWith({
            preset: 'createProject',
        });
    });

    describe('preset hooks', function () {});
});

describe('store api', function () {
    it('no changes -> same snapshot', function () {
        const options = getOptions();

        const controller = new Controller(options);

        const snapshot1 = controller.getSnapshot();
        const snapshot2 = controller.getSnapshot();

        expect(snapshot1).toBe(snapshot2);
    });

    it('init -> no callback calls', function () {
        const options = getOptions();

        const controller = new Controller(options);
        const cb = jest.fn();

        controller.subscribe(cb);

        expect(cb).not.toHaveBeenCalled();
    });

    it('load progress -> trigger callback', async function () {
        const options = getOptions();

        const controller = new Controller(options);
        const cb = jest.fn();
        controller.subscribe(cb);

        await controller.stepElementReached({
            stepSlug: 'createSprint',
            element: getAnchorElement(),
        });

        expect(cb).toHaveBeenCalled();
    });

    it('change state -> trigger callback', async function () {
        const options = getOptions();

        const controller = new Controller(options);

        const cb = jest.fn();
        controller.subscribe(cb);

        await controller.addPreset('createQueue');

        expect(cb).toHaveBeenCalled();
    });

    it('change state -> new state object', async function () {
        const options = getOptions();

        const controller = new Controller(options);

        const snapshot1 = controller.getSnapshot();
        await controller.addPreset('createQueue');
        const snapshot2 = controller.getSnapshot();

        expect(Object.is(snapshot1, snapshot2)).toBe(false);
    });

    it('change progress -> trigger callback', async function () {
        const options = getOptions();

        const controller = new Controller(options);

        const cb = jest.fn();
        controller.subscribe(cb);

        await controller.passStep('createSprint');

        expect(cb).toHaveBeenCalled();
    });

    it('change progress -> new state object', async function () {
        const options = getOptions();

        const controller = new Controller(options);

        const snapshot1 = controller.getSnapshot();
        await controller.passStep('createSprint');
        const snapshot2 = controller.getSnapshot();

        expect(Object.is(snapshot1, snapshot2)).toBe(false);
    });

    it('unsubscribe -> no cb', async function () {
        const options = getOptions();

        const controller = new Controller(options);

        const cb = jest.fn();
        const unsubscribe = controller.subscribe(cb);
        unsubscribe();

        await controller.addPreset('createQueue');

        expect(cb).not.toHaveBeenCalled();
    });
});
