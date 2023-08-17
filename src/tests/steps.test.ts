import {Controller} from '../controller';
import {getAnchorElement, getOptions} from './utils';

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
            const options = getOptions({wizardState: 'visible'});

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
        it('pass step -> nothing happened', async function () {
            const options = getOptions({wizardState: 'collapsed', activePresets: []});

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