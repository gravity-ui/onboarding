import {Controller} from './controller';
import type {BaseState, ProgressState, PresetStep} from './types';

const getOptions = (
    baseState: Partial<BaseState> = {},
    progressState: Partial<ProgressState> = {},
) => {
    return {
        config: {
            presets: {
                createProject: {
                    name: 'Creating project',
                    steps: [
                        {
                            slug: 'openBoard',
                            name: '',
                            description: '',
                        },
                        {
                            slug: 'createSprint',
                            name: '',
                            description: '',
                        },
                        {
                            slug: 'createIssue',
                            name: '',
                            description: '',
                        },
                    ] as Array<PresetStep<string, {}>>,
                },
                createQueue: {
                    name: 'Creating queue',
                    steps: [],
                },
            },
        },
        baseState: {
            wizardActive: true,
            activePresets: ['createProject'],
            suggestedPresets: ['createProject'],
            ...baseState,
        },
        getProgressState: jest.fn(() =>
            Promise.resolve({
                presetPassedSteps: {
                    createProject: ['openBoard'],
                },
                finishedPresets: [],
                ...progressState,
            }),
        ),
        onSave: {
            state: jest.fn(),
            progress: jest.fn(),
        },
        showHint: jest.fn(),
        debugMode: false,
        logger: {
            level: 'error' as const,
            logger: {
                log: () => {},
                error: () => {},
            },
        },
    };
};

const getAnchorElement = () => {
    const element = document.createElement('div');
    document.body.appendChild(element);

    return element;
};

describe('base behavior', function () {
    it('show wizard -> save base state', async function () {
        const options = getOptions({wizardActive: false});

        const controller = new Controller(options);
        await controller.showWizard();

        const newState = options.onSave.state.mock.calls[0][0];

        expect(newState.wizardActive).toBe(true);
    });

    it('hide wizard -> save base state', async function () {
        const options = getOptions();

        const controller = new Controller(options);
        await controller.hideWizard();

        const newState = options.onSave.state.mock.calls[0][0];

        expect(newState.wizardActive).toBe(false);
    });
});

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

describe('pass step', function () {
    describe('active preset', function () {
        it('pass step on active preset -> save new data', async function () {
            const options = getOptions();

            const controller = new Controller(options);
            await controller.passStep('createSprint');

            const newState = options.onSave.progress.mock.calls[0][0];

            expect(newState.presetPassedSteps.createProject).toEqual(['openBoard', 'createSprint']);
        });

        it('pass step twice on active preset -> save only once', async function () {
            const options = getOptions();

            const controller = new Controller(options);
            await controller.passStep('createSprint');

            expect(options.onSave.progress).toHaveBeenCalledTimes(1);
        });

        it('pass step on active preset with disabled wizard -> save new data', async function () {
            const options = getOptions({wizardActive: false});

            const controller = new Controller(options);
            await controller.passStep('createSprint');

            const newState = options.onSave.progress.mock.calls[0][0];

            expect(newState.presetPassedSteps.createProject).toEqual(['openBoard', 'createSprint']);
        });

        it('pass passed step again -> not save progrewss', async function () {
            const options = getOptions();

            const controller = new Controller(options);
            await controller.passStep('openBoard');

            expect(options.onSave.progress).not.toHaveBeenCalled();
        });

        it('pass passed step again -> save only once', async function () {
            const options = getOptions();

            const controller = new Controller(options);
            await controller.passStep('createSprint');
            await controller.passStep('createSprint');

            expect(options.getProgressState).toHaveBeenCalledTimes(1);
            expect(options.onSave.progress).toHaveBeenCalledTimes(1);
        });

        it('pass step -> hide hint', async function () {
            const options = getOptions();

            const controller = new Controller(options);
            await controller.stepElementReached({
                stepSlug: 'createSprint',
                element: getAnchorElement(),
            });
            await controller.passStep('createSprint');

            const snapshot = controller.hintStore.getSnapshot();

            expect(snapshot.open).toBe(false);
        });

        it('passMode: "onShowHint": pass step -> dont hint', async function () {
            const options = getOptions(
                {},
                {
                    presetPassedSteps: {
                        createProject: ['openBoard', 'createSprint', 'createIssue'],
                    },
                },
            );

            options.config.presets.createProject.steps.push({
                slug: 'issueButtons',
                name: '',
                description: '',
                passMode: 'onShowHint',
            });

            const controller = new Controller(options);
            await controller.stepElementReached({
                stepSlug: 'issueButtons',
                element: getAnchorElement(),
            });

            const snapshot = controller.hintStore.getSnapshot();

            expect(snapshot.open).toBe(true);
        });
    });

    describe('not active preset', function () {
        it('pass step -> nothing happend', async function () {
            const options = getOptions({activePresets: []});

            const controller = new Controller(options);
            await controller.passStep('createSprint');

            expect(options.getProgressState).not.toHaveBeenCalled();
            expect(options.onSave.progress).not.toHaveBeenCalled();
        });
    });

    describe('passAvailable=afterPrevious', function () {
        it("not next step -> can't pass", async function () {
            const options = getOptions();
            // @ts-ignore
            options.config.presets.createProject.steps[2].passRestriction = 'afterPrevious';

            const controller = new Controller(options);
            await controller.passStep('createIssue');

            expect(options.onSave.progress).not.toHaveBeenCalled();
        });
    });

    it('finish preset -> remove from active add to finished', async function () {
        const options = getOptions(
            {},
            {presetPassedSteps: {createProject: ['openBoard', 'createSprint']}},
        );

        const controller = new Controller(options);
        await controller.passStep('createIssue');

        const newBaseState = options.onSave.state.mock.calls[0][0];
        const newProgressState = options.onSave.progress.mock.calls[0][0];

        expect(newBaseState.activePresets).toEqual([]);
        expect(newProgressState.finishedPresets).toEqual(['createProject']);
        expect(options.onSave.progress).toHaveBeenCalledTimes(1);
    });

    describe('step hooks', function () {
        it('pass step -> call onPass hook', async function () {
            const options = getOptions();
            const mock = jest.fn();

            options.config.presets.createProject.steps[1].hooks = {onStepPass: mock};

            const controller = new Controller(options);
            await controller.passStep('createSprint');

            expect(mock).toHaveBeenCalled();
        });
    });
});

describe('hints', function () {
    it('reachElement -> show hint', async function () {
        const options = getOptions();

        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'createSprint',
            element: getAnchorElement(),
        });

        expect(options.showHint).toHaveBeenCalled();
    });

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

    it('reachElement -> show only first unpassed step hint', async function () {
        const options = getOptions();

        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'createIssue',
            element: getAnchorElement(),
        });

        expect(options.showHint).not.toHaveBeenCalled();
    });

    it('not active preset, reachElement -> nothing', async function () {
        const options = getOptions({activePresets: []});

        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'createSprint',
            element: getAnchorElement(),
        });

        expect(options.showHint).not.toHaveBeenCalled();
    });

    it('reach element passed step -> nothing', async function () {
        const options = getOptions();

        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'openBoard',
            element: getAnchorElement(),
        });

        expect(options.showHint).not.toHaveBeenCalled();
    });

    it('not active onboarding -> nothing', async function () {
        const options = getOptions({wizardActive: false});

        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'createSprint',
            element: getAnchorElement(),
        });

        expect(options.showHint).not.toHaveBeenCalled();
    });

    describe('close hint', function () {
        it('call closeHint -> hint closed', async function () {
            const options = getOptions();
            const controller = new Controller(options);
            await controller.stepElementReached({
                stepSlug: 'createSprint',
                element: getAnchorElement(),
            });
            await controller.closeHint();

            const snapshot = controller.hintStore.getSnapshot();
            expect(snapshot.open).toBe(false);
        });

        it('closeHintForStep closes target hint', async function () {
            const options = getOptions();
            const controller = new Controller(options);
            await controller.stepElementReached({
                stepSlug: 'createSprint',
                element: getAnchorElement(),
            });
            await controller.closeHintForStep('createSprint');

            const snapshot = controller.hintStore.getSnapshot();
            expect(snapshot.open).toBe(false);
        });

        it('closeHintForStep do nothing with not tagret hint', async function () {
            const options = getOptions();
            const controller = new Controller(options);
            await controller.stepElementReached({
                stepSlug: 'createSprint',
                element: getAnchorElement(),
            });
            await controller.closeHintForStep('randomStep');

            const snapshot = controller.hintStore.getSnapshot();
            expect(snapshot.open).toBe(true);
        });

        it("closeOnElementUnmount = false -> don't close hint", async function () {
            const options = getOptions();
            options.config.presets.createProject.steps[1].closeOnElementUnmount = false;

            const controller = new Controller(options);
            await controller.stepElementReached({
                stepSlug: 'createSprint',
                element: getAnchorElement(),
            });
            await controller.stepElementDisappeared('createSprint');

            const snapshot = controller.hintStore.getSnapshot();
            expect(snapshot.open).toBe(true);
        });
    });

    it('hint element changes -> update anchorRef', async function () {
        const options = getOptions();
        options.config.presets.createProject.steps[1].closeOnElementUnmount = false;

        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'createSprint',
            element: getAnchorElement(),
        });
        const newElement = getAnchorElement();
        await controller.stepElementReached({
            stepSlug: 'createSprint',
            element: newElement,
        });

        const snapshot = controller.hintStore.getSnapshot();
        expect(snapshot.anchorRef.current).toBe(newElement);
    });

    it('removed preset in active  -> show hint', async function () {
        const options = getOptions({
            // removed preset first
            activePresets: ['strangeRemovedPreset', 'createProject'],
        });

        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'createSprint',
            element: getAnchorElement(),
        });

        expect(options.showHint).toHaveBeenCalled();
        // don't throw error
    });

    describe('Many visible elements on one page', function () {
        it('should show hint only once for session', async function () {
            const options = getOptions();

            const controller = new Controller(options);
            controller.stepElementReached({
                stepSlug: 'createSprint',
                element: getAnchorElement(),
            });
            await controller.stepElementReached({
                stepSlug: 'createSprint',
                element: getAnchorElement(),
            });

            await expect(options.showHint).toHaveBeenCalledTimes(1);
        });

        it('pass step -> show next popup', async function () {
            const options = getOptions();

            const controller = new Controller(options);
            await controller.stepElementReached({
                stepSlug: 'createSprint',
                element: getAnchorElement(),
            });
            await controller.stepElementReached({
                stepSlug: 'createIssue',
                element: getAnchorElement(),
            });

            await controller.passStep('createSprint');

            const snapshot = controller.hintStore.getSnapshot();

            expect(snapshot.open).toBe(true);
            expect(snapshot.hint?.step.slug).toBe('createIssue');
        });
    });

    describe('passMode onShowHint', function () {
        it('reachElement -> show only first unpassed step hint', async function () {
            const options = getOptions(
                {},
                {
                    presetPassedSteps: {
                        createProject: ['openBoard', 'createSprint', 'createIssue'],
                    },
                },
            );

            options.config.presets.createProject.steps.push({
                slug: 'issueButtons',
                name: '',
                description: '',
                passMode: 'onShowHint',
            });

            const controller = new Controller(options);
            await controller.stepElementReached({
                stepSlug: 'issueButtons',
                element: getAnchorElement(),
            });

            const newState = options.onSave.progress.mock.calls[0][0];

            expect(newState.presetPassedSteps.createProject).toEqual([
                'openBoard',
                'createSprint',
                'createIssue',
                'issueButtons',
            ]);
        });

        it('on one page with normal hint -> show first before close', async function () {
            const options = getOptions();

            options.config.presets.createProject.steps[1].passMode = 'onShowHint';

            const controller = new Controller(options);
            await controller.stepElementReached({
                stepSlug: 'createSprint',
                element: getAnchorElement(),
            });
            await controller.stepElementReached({
                stepSlug: 'createIssue',
                element: getAnchorElement(),
            });

            const snapshot = controller.hintStore.getSnapshot();

            expect(snapshot.open).toBe(true);
            expect(snapshot.hint?.step.slug).toBe('createSprint');
        });

        it('on one page with normal hint -> show next after close', async function () {
            const options = getOptions();

            options.config.presets.createProject.steps[1].passMode = 'onShowHint';

            const controller = new Controller(options);
            await controller.stepElementReached({
                stepSlug: 'createSprint',
                element: getAnchorElement(),
            });
            await controller.stepElementReached({
                stepSlug: 'createIssue',
                element: getAnchorElement(),
            });
            await controller.closeHint();

            const snapshot = controller.hintStore.getSnapshot();

            expect(snapshot.open).toBe(true);
            expect(snapshot.hint?.step.slug).toBe('createIssue');
        });
    });

    describe('hint store', function () {
        it('reachElement -> show hint', async function () {
            const options = getOptions();

            const controller = new Controller(options);
            await controller.stepElementReached({
                stepSlug: 'createSprint',
                element: getAnchorElement(),
            });

            const snapshot = controller.hintStore.getSnapshot();

            expect(snapshot.hint).toEqual({
                preset: 'createProject',
                step: {
                    slug: 'createSprint',
                    name: '',
                    description: '',
                },
            });
            expect(snapshot.open).toBe(true);
            expect(snapshot.anchorRef.current).toBeDefined();
        });
    });

    it('load progress only once', async function () {
        const options = getOptions();

        const controller = new Controller(options);

        const element1 = getAnchorElement();
        const element2 = getAnchorElement();

        const promise1 = controller.stepElementReached({
            stepSlug: 'createSprint',
            element: element1,
        });
        const promise2 = controller.stepElementReached({
            stepSlug: 'createSprint',
            element: element2,
        });

        await Promise.all([promise1, promise2]);

        expect(options.getProgressState).toHaveBeenCalledTimes(1);
    });
});

describe('find next step', function () {
    it('no preset steps -> undefined', function () {
        const passedSteps = ['createBoard', 'openBoard'];

        // @ts-ignore
        expect(Controller.findNextUnpassedStep(undefined, passedSteps)).toBe(undefined);
    });

    it('pass some step from preset', function () {
        const preset = ['createBoard', 'openBoard', 'createIssue', 'changeIssueStatus'];
        const passedSteps = ['createBoard', 'openBoard'];

        expect(Controller.findNextUnpassedStep(preset, passedSteps)).toBe('createIssue');
    });

    it('ignore skipped step', function () {
        const preset = ['createBoard', 'openBoard', 'createIssue', 'changeIssueStatus'];
        const passedSteps = ['createBoard', 'createIssue'];

        expect(Controller.findNextUnpassedStep(preset, passedSteps)).toBe('changeIssueStatus');
    });

    it('ignore unknown step', function () {
        const preset = ['createBoard', 'openBoard', 'createIssue', 'changeIssueStatus'];
        const passedSteps = ['createBoard', 'clickedOnBoard'];

        expect(Controller.findNextUnpassedStep(preset, passedSteps)).toBe('openBoard');
    });

    it('ignore unknown step between passed (renamed step)', function () {
        const preset = ['createBoard', 'openBoard', 'createIssue', 'changeIssueStatus'];
        const passedSteps = ['createBoard', 'clickedOnBoard', 'createIssue'];

        expect(Controller.findNextUnpassedStep(preset, passedSteps)).toBe('changeIssueStatus');
    });
});

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

describe('suggest once', function () {
    it('first preset run -> runs', async function () {
        const options = getOptions({wizardActive: false});

        const controller = new Controller(options);
        await controller.suggestPresetOnce('createQueue');

        const newState = options.onSave.state.mock.calls[0][0];

        expect(newState.wizardActive).toBe(true);
    });

    it('call -> add preset', async function () {
        const options = getOptions();

        const controller = new Controller(options);
        await controller.suggestPresetOnce('createQueue');

        const newState = options.onSave.state.mock.calls[0][0];

        expect(newState.activePresets).toEqual(['createProject', 'createQueue']);
    });

    it('second run -> nothing', async function () {
        const options = getOptions({wizardActive: false});

        const controller = new Controller(options);
        await controller.suggestPresetOnce('createQueue');
        await controller.hideWizard();

        await controller.suggestPresetOnce('createQueue');

        expect(controller.state.base.wizardActive).toBe(false);
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
