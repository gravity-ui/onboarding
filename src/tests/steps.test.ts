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

        describe('passMode: "onShowHint"', function () {
            it('show hint step -> step passed hint', async function () {
                const options = getOptions();

                options.config.presets.createProject.steps[1].passMode = 'onShowHint';

                const controller = new Controller(options);
                await controller.stepElementReached({
                    stepSlug: 'createSprint',
                    element: getAnchorElement(),
                });

                const newProgressState = options.onSave.progress.mock.calls[0][0];

                expect(newProgressState.presetPassedSteps.createProject).toContain('createSprint');
            });

            it('show hint for last step -> finish preset', async function () {
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

                const newProgressState = options.onSave.progress.mock.calls[0][0];

                expect(newProgressState.finishedPresets).toContain('createProject');
            });
        });
    });

    describe('not active preset', function () {
        it('not active but available preset -> can pass step', async function () {
            const options = getOptions({
                wizardState: 'collapsed',
                activePresets: [],
                availablePresets: ['createProject'],
            });

            const controller = new Controller(options);
            await controller.passStep('createSprint');

            expect(options.getProgressState).toHaveBeenCalled();
            expect(options.onSave.progress).toHaveBeenCalled();
        });

        it('not active, not available -> nothing happened', async function () {
            const options = getOptions({
                wizardState: 'collapsed',
                activePresets: [],
                availablePresets: [],
            });

            const controller = new Controller(options);
            await controller.passStep('createSprint');

            expect(options.getProgressState).not.toHaveBeenCalled();
            expect(options.onSave.progress).not.toHaveBeenCalled();
        });
    });

    describe('passRestriction=afterPrevious', function () {
        it("not next step -> can't pass", async function () {
            const options = getOptions();
            // @ts-ignore
            options.config.presets.createProject.steps[2].passRestriction = 'afterPrevious';

            const controller = new Controller(options);
            await controller.passStep('createIssue');

            expect(options.onSave.progress).not.toHaveBeenCalled();
        });

        it("not active preset, not next step -> can't pass", async function () {
            const options = getOptions({activePresets: []});
            // @ts-ignore
            options.config.presets.createProject.steps[2].passRestriction = 'afterPrevious';

            const controller = new Controller(options);
            await controller.passStep('createIssue');

            expect(options.onSave.progress).not.toHaveBeenCalled();
        });
    });

    describe('shared steps', function () {
        const sharedStep = {
            slug: 'sharedStep',
            name: '',
            description: '',
        };

        it('pass shared step -> pick active preset', async function () {
            const options = getOptions({
                availablePresets: ['createProject', 'createQueue'],
                activePresets: ['createQueue'],
            });
            options.config.presets.createProject.steps = [sharedStep];
            options.config.presets.createQueue.steps = [sharedStep];

            const controller = new Controller(options);
            await controller.passStep('sharedStep');

            const newState = options.onSave.progress.mock.calls[0][0];

            expect(newState.presetPassedSteps.createQueue).toEqual(['sharedStep']);
        });
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

        it('user close hint -> call onCloseHintByUser and onCloseHint', async function () {
            const options = getOptions();
            const onCloseHintByUserMock = jest.fn();
            const onCloseHintMock = jest.fn();

            options.config.presets.createProject.steps[1].hooks = {
                onCloseHintByUser: onCloseHintByUserMock,
                onCloseHint: onCloseHintMock,
            };

            const controller = new Controller(options);
            await controller.stepElementReached({
                stepSlug: 'createSprint',
                element: getAnchorElement(),
            });
            await controller.closeHintByUser();

            expect(onCloseHintByUserMock).toHaveBeenCalled();
            expect(onCloseHintMock).toHaveBeenCalled();
        });

        it('element disappear -> call only onCloseHint', async function () {
            const options = getOptions();
            const onCloseHintByUserMock = jest.fn();
            const onCloseHintMock = jest.fn();

            options.config.presets.createProject.steps[1].hooks = {
                onCloseHintByUser: onCloseHintByUserMock,
                onCloseHint: onCloseHintMock,
            };

            const controller = new Controller(options);
            await controller.stepElementReached({
                stepSlug: 'createSprint',
                element: getAnchorElement(),
            });
            await controller.stepElementDisappeared('createSprint');

            expect(onCloseHintByUserMock).not.toHaveBeenCalled();
            expect(onCloseHintMock).toHaveBeenCalled();
        });

        it('pass step -> call onCloseHint + onCloseByUser', async function () {
            const options = getOptions();
            const onCloseHintByUserMock = jest.fn();
            const onCloseHintMock = jest.fn();

            options.config.presets.createProject.steps[1].hooks = {
                onCloseHintByUser: onCloseHintByUserMock,
                onCloseHint: onCloseHintMock,
            };

            const controller = new Controller(options);
            await controller.stepElementReached({
                stepSlug: 'createSprint',
                element: getAnchorElement(),
            });
            await controller.passStep('createSprint');

            expect(onCloseHintByUserMock).toHaveBeenCalled();
            expect(onCloseHintMock).toHaveBeenCalled();
        });
    });
});

describe('find next step', function () {
    it('no preset steps -> undefined', function () {
        const passedSteps = ['createBoard', 'openBoard'];

        // @ts-ignore
        expect(Controller.findNextUnpassedStep(undefined, passedSteps)).toBe(undefined);
    });

    it('no passed steps -> first preset step', function () {
        const preset = ['createBoard', 'openBoard', 'createIssue', 'changeIssueStatus'];
        const passedSteps = [] as string[];

        expect(Controller.findNextUnpassedStep(preset, passedSteps)).toBe('createBoard');
    });

    it('no passed steps -> first preset step11', function () {
        const preset = ['createBoard', 'openBoard', 'createIssue', 'changeIssueStatus'];
        const passedSteps = ['createBoard', 'createIssue', 'changeIssueStatus'];

        expect(Controller.findNextUnpassedStep(preset, passedSteps)).toBe(undefined);
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

    it('all steps passed -> undefined', function () {
        const preset = ['createBoard', 'openBoard', 'createIssue', 'changeIssueStatus'];
        const passedSteps = ['createBoard', 'openBoard', 'createIssue', 'changeIssueStatus'];

        expect(Controller.findNextUnpassedStep(preset, passedSteps)).toBe(undefined);
    });
});
