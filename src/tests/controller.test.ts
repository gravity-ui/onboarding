import {Controller} from '../controller';
import {getAnchorElement, getOptions} from './utils';

describe('hooks', function () {
    const getOptionsWithHooks = (...args: Parameters<typeof getOptions>) => ({
        ...getOptions(...args),
        hooks: {
            onShowHint: jest.fn(),
            onStepPass: jest.fn(),
            onAddPreset: jest.fn(),
            onFinishPreset: jest.fn(),
        },
    });

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

    it('add preset -> calls onAddPreset', async function () {
        const options = getOptionsWithHooks();

        const controller = new Controller(options);
        await controller.addPreset('createQueue');

        expect(options.hooks.onAddPreset).toHaveBeenCalledWith({
            preset: 'createQueue',
        });
    });

    describe('preset hooks', function () {
        it('start preset -> calls onStart', async function () {
            const options = getOptions();
            const mock = jest.fn();
            // @ts-ignore
            options.config.presets.createQueue.hooks = {onStart: mock};

            const controller = new Controller(options);
            await controller.addPreset('createQueue');

            expect(mock).toHaveBeenCalled();
        });

        it('finish preset -> calls enEnd', async function () {
            const options = getOptions();
            const mock = jest.fn();
            // @ts-ignore
            options.config.presets.createProject.hooks = {onEnd: mock};

            const controller = new Controller(options);
            await controller.finishPreset('createProject');

            expect(mock).toHaveBeenCalled();
        });
    });
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
