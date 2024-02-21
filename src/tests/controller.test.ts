import {Controller} from '../controller';
import {getAnchorElement, getOptions, getOptionsWithHooks} from './utils';

describe('init with not full data', function () {
    it('empty progress, reachElement -> show hint', async function () {
        const options = getOptions();
        // @ts-ignore
        options.getProgressState = () => Promise.resolve({});

        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'openBoard',
            element: getAnchorElement(),
        });

        expect(options.showHint).toHaveBeenCalled();
    });

    it('should init with empty base state', async function () {
        const options = getOptions();
        // @ts-ignore
        options.baseState = undefined;

        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'openBoard',
            element: getAnchorElement(),
        });

        // not throw error
    });
});

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

    it('pass step on NOT active, but available preset -> calls onPassStep', async function () {
        const options = getOptionsWithHooks({activePresets: []});

        const controller = new Controller(options);
        await controller.passStep('createSprint');

        expect(options.hooks.onStepPass).toHaveBeenCalledWith({
            preset: 'createProject',
            step: 'createSprint',
        });
    });

    it('pass step on NOT active and NOT available preset -> NOT calls onPassStep', async function () {
        const options = getOptionsWithHooks({activePresets: [], availablePresets: []});

        const controller = new Controller(options);
        await controller.passStep('createSprint');

        expect(options.hooks.onStepPass).not.toHaveBeenCalled();
    });

    describe('preset hooks', function () {
        it('run preset -> call onRunPreset', async function () {
            expect.assertions(1);
            const options = getOptionsWithHooks();

            const controller = new Controller(options);
            options.hooks.onRunPreset = jest.fn(() => {
                expect(controller.state.base.activePresets).toContain('createQueue');
            });

            await controller.runPreset('createQueue');
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

    it('change state -> deep field updates', async function () {
        const options = getOptions();

        const controller = new Controller(options);

        const snapshot1 = controller.getSnapshot();
        await controller.addPreset('createQueue');
        const snapshot2 = controller.getSnapshot();

        expect(Object.is(snapshot1.base.activePresets, snapshot2.base.activePresets)).toBe(false);
        expect(Object.is(snapshot1.base.availablePresets, snapshot2.base.availablePresets)).toBe(
            false,
        );
        expect(Object.is(snapshot1.base.suggestedPresets, snapshot2.base.suggestedPresets)).toBe(
            false,
        );
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

    it('change progress -> deep field updates', async function () {
        const options = getOptions();

        const controller = new Controller(options);

        const snapshot1 = controller.getSnapshot();
        await controller.passStep('createSprint');
        const snapshot2 = controller.getSnapshot();

        expect(
            Object.is(snapshot1.progress?.presetPassedSteps, snapshot2.progress?.presetPassedSteps),
        ).toBe(false);
        expect(
            Object.is(snapshot1.progress?.finishedPresets, snapshot2.progress?.finishedPresets),
        ).toBe(false);
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

    describe('batching update', () => {
        it('base state manipulation -> 1 onSave.state call', async function () {
            const options = getOptions({availablePresets: []});

            const controller = new Controller(options);
            const promise1 = controller.addPreset('createQueue');
            const promise2 = controller.addPreset('createProject');
            const promise3 = controller.setWizardState('invisible');

            await Promise.all([promise1, promise2, promise3]);

            expect(options.onSave.state).toHaveBeenCalledTimes(1);
        });

        it('progress manipulation -> 1 onSave.progress call', async function () {
            const options = getOptions(
                {
                    availablePresets: ['createProject'],
                    activePresets: ['createProject'],
                    wizardState: 'hidden',
                },
                {finishedPresets: []},
            );

            const controller = new Controller(options);

            const promise1 = controller.finishPreset('createProject');
            const promise2 = controller.resetPresetProgress('createProject');
            const promise3 = controller.runPreset('createProject');

            await Promise.all([promise1, promise2, promise3]);

            expect(options.onSave.progress).toHaveBeenCalledTimes(1);
        });
    });
});

it('resetToDefaultState -> hidden and empty ', async function () {
    const options = getOptions();

    const controller = new Controller(options);
    await controller.ensureRunning();

    await controller.resetToDefaultState();

    expect(controller.state).toEqual({
        base: {
            activePresets: [],
            availablePresets: [],
            suggestedPresets: [],
            wizardState: 'hidden',
        },
        progress: {
            finishedPresets: [],
            presetPassedSteps: {},
        },
    });
});
