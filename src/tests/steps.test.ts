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

        it('should prevent passing step with afterPrevious restriction when previous not passed', async () => {
            const options = getOptions();
            // @ts-ignore
            options.config.presets.restrictedPreset = {
                name: 'Restricted Preset',
                steps: [
                    {slug: 'step1', name: 'Step 1', description: 'First'},
                    {
                        slug: 'step2',
                        name: 'Step 2',
                        description: 'Second',
                        passRestriction: 'afterPrevious',
                    },
                    {
                        slug: 'step3',
                        name: 'Step 3',
                        description: 'Third',
                        passRestriction: 'afterPrevious',
                    },
                ],
            } as any;

            const controller = new Controller(options);
            await controller.runPreset('restrictedPreset');

            // Attempt to pass step2 without completing step1
            await controller.passStep('step2');

            // step2 should not be passed (array should be empty or not contain step2)
            const passedSteps = controller.state.progress?.presetPassedSteps.restrictedPreset || [];
            expect(passedSteps.includes('step2')).toBe(false);
        });

        it('should allow passing step with afterPrevious restriction when previous is passed', async () => {
            const options = getOptions();
            // @ts-ignore
            options.config.presets.restrictedPreset = {
                name: 'Restricted Preset',
                steps: [
                    {slug: 'step1', name: 'Step 1', description: 'First'},
                    {
                        slug: 'step2',
                        name: 'Step 2',
                        description: 'Second',
                        passRestriction: 'afterPrevious',
                    },
                    {
                        slug: 'step3',
                        name: 'Step 3',
                        description: 'Third',
                        passRestriction: 'afterPrevious',
                    },
                ],
            } as any;

            const controller = new Controller(options);
            await controller.runPreset('restrictedPreset');

            // Pass step1
            await controller.passStep('step1');
            // Now we can pass step2
            await controller.passStep('step2');

            const passedSteps = controller.state.progress?.presetPassedSteps.restrictedPreset || [];
            expect(passedSteps.includes('step2')).toBe(true);
        });

        it('should handle restriction for non-active preset', async () => {
            const options = getOptions();
            // @ts-ignore
            options.config.presets.restrictedPreset = {
                name: 'Restricted Preset',
                steps: [
                    {slug: 'step1', name: 'Step 1', description: 'First'},
                    {
                        slug: 'step2',
                        name: 'Step 2',
                        description: 'Second',
                        passRestriction: 'afterPrevious',
                    },
                ],
            } as any;

            const controller = new Controller(options);
            // Don't activate the preset
            controller.state.base.availablePresets.push('restrictedPreset');

            // Attempt to pass step2 without activating the preset
            await controller.passStep('step2');

            // step2 should not be passed
            const passedSteps = controller.state.progress?.presetPassedSteps.restrictedPreset || [];
            expect(passedSteps.includes('step2')).toBe(false);
        });
    });

    describe('step hooks', function () {
        describe('onStepPass', () => {
            it('pass step -> call onPass hook', async function () {
                const options = getOptions();
                const mock = jest.fn();

                options.config.presets.createProject.steps[1].hooks = {onStepPass: mock};

                const controller = new Controller(options);
                await controller.passStep('createSprint');

                expect(mock).toHaveBeenCalled();
            });

            it('passed step -> dont call hook', async function () {
                const options = getOptions();
                const mock = jest.fn();

                options.config.presets.createProject.steps[0].hooks = {onStepPass: mock};

                const controller = new Controller(options);
                await controller.passStep('openBoard');

                expect(mock).not.toHaveBeenCalled();
            });
        });

        describe('closeHint hooks', () => {
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

                expect(onCloseHintByUserMock).toHaveBeenCalledWith({eventSource: 'closedByUser'});
                expect(onCloseHintMock).toHaveBeenCalledWith({eventSource: 'closedByUser'});
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
                expect(onCloseHintMock).toHaveBeenCalledWith({eventSource: 'elementHidden'});
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

                expect(onCloseHintByUserMock).toHaveBeenCalledWith({eventSource: 'stepPassed'});
                expect(onCloseHintMock).toHaveBeenCalledWith({eventSource: 'stepPassed'});
            });

            it('call closeHint -> call onCloseHint with eventSource=externalEvent', async function () {
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
                await controller.closeHint();

                expect(onCloseHintByUserMock).not.toHaveBeenCalled();
                expect(onCloseHintMock).toHaveBeenCalledWith({eventSource: 'externalEvent'});
            });
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

    it('should handle passed steps in wrong order', function () {
        const presetSteps = ['step1', 'step2', 'step3', 'step4'];
        const passedSteps = ['step3', 'step1']; // incorrect order

        const result = Controller.findNextUnpassedStep(presetSteps, passedSteps);
        // Algorithm searches from the end: step4 not passed, step3 passed -> returns step4
        expect(result).toBe('step4');
    });

    it('should handle single step preset', function () {
        const presetSteps = ['step1'];
        const passedSteps: string[] = [];

        const result = Controller.findNextUnpassedStep(presetSteps, passedSteps);
        expect(result).toBe('step1');
    });

    it('should handle single step preset when passed', function () {
        const presetSteps = ['step1'];
        const passedSteps = ['step1'];

        const result = Controller.findNextUnpassedStep(presetSteps, passedSteps);
        expect(result).toBeUndefined();
    });
});
