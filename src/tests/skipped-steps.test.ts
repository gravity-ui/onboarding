import {Controller} from '../controller';
import {getAnchorElement, getOptions, getOptionsWithCombined, getSameStepsOptions} from './utils';
import type {InitOptions, ProgressState} from '../types';
import {createControlledPromise} from '../debounce';

const getSkipOptions = (progress: Partial<ProgressState> = {}) => ({
    ...getOptions({}, {presetPassedSteps: {}, ...progress}),
    hooks: {
        stepPass: vi.fn(),
        stepSkip: vi.fn(),
        finishPreset: vi.fn(),
        skipPreset: vi.fn(),
        closeHintByUser: vi.fn(),
    },
});

describe('skipping an action completed before its hint', () => {
    it('stores the skip separately and shows the next unresolved step', async () => {
        const options = getSkipOptions();
        const onStepPass = vi.fn();
        const onStepSkip = vi.fn();
        options.config.presets.createProject.steps[0].hooks = {onStepPass, onStepSkip};
        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'createSprint',
            element: getAnchorElement(),
        });

        await controller.skipStep('openBoard');

        expect(controller.state.progress?.presetSkippedSteps?.createProject).toEqual(['openBoard']);
        expect(controller.state.progress?.presetPassedSteps).toEqual({});
        expect(options.onSave.progress.mock.lastCall?.[0].presetSkippedSteps).toEqual({
            createProject: ['openBoard'],
        });
        expect(onStepSkip).toHaveBeenCalledOnce();
        expect(onStepPass).not.toHaveBeenCalled();
        expect(options.hooks.stepSkip).toHaveBeenCalledWith(
            {preset: 'createProject', step: 'openBoard'},
            controller,
        );
        expect(options.hooks.stepPass).not.toHaveBeenCalled();
        expect(options.hooks.finishPreset).not.toHaveBeenCalled();
        expect(options.hooks.skipPreset).not.toHaveBeenCalled();
        expect(controller.hintStore.state.hint?.step.slug).toBe('createSprint');
    });

    it('does not skip pending earlier steps when a later action is already completed', async () => {
        const options = getSkipOptions();
        const controller = new Controller(options);
        await controller.skipStep('createIssue');
        await controller.stepElementReached({stepSlug: 'openBoard', element: getAnchorElement()});

        expect(controller.hintStore.state.hint?.step.slug).toBe('openBoard');
        expect(controller.state.progress?.finishedPresets).toEqual([]);
        expect(options.hooks.skipPreset).not.toHaveBeenCalled();

        await controller.passStep('openBoard');
        expect(controller.state.progress?.finishedPresets).toEqual([]);
        await controller.passStep('createSprint');
        expect(options.hooks.finishPreset).toHaveBeenCalledOnce();
        expect(options.hooks.skipPreset).not.toHaveBeenCalled();
    });

    it('marks an entirely skipped scenario as closed without a success event', async () => {
        const options = getSkipOptions();
        const controller = new Controller(options);
        await controller.skipStep('openBoard');
        await controller.skipStep('createSprint');
        await controller.skipStep('createIssue');
        await controller.skipStep('createIssue');
        await controller.passStep('createIssue');

        expect(options.hooks.stepSkip).toHaveBeenCalledTimes(3);
        expect(options.hooks.stepPass).not.toHaveBeenCalled();
        expect(options.hooks.skipPreset).toHaveBeenCalledOnce();
        expect(options.hooks.finishPreset).not.toHaveBeenCalled();
        expect(controller.state.base.activePresets).toEqual([]);
        expect(controller.state.progress?.finishedPresets).toEqual(['createProject']);
        expect(controller.state.progress?.presetPassedSteps).toEqual({});
    });

    it('does not let unknown historical skips change legacy completion', async () => {
        const options = getSkipOptions({presetSkippedSteps: {createProject: ['removedStep']}});
        const controller = new Controller(options);
        await controller.passStep('createIssue');

        expect(options.hooks.finishPreset).toHaveBeenCalledOnce();
    });

    it('does not reclassify a passed step or close a different active hint', async () => {
        const options = getSkipOptions({presetPassedSteps: {createProject: ['openBoard']}});
        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'createSprint',
            element: getAnchorElement(),
        });
        await controller.skipStep('openBoard');
        await controller.skipStep('createIssue');

        expect(controller.state.progress?.presetPassedSteps.createProject).toEqual(['openBoard']);
        expect(controller.state.progress?.presetSkippedSteps?.createProject).toEqual([
            'createIssue',
        ]);
        expect(controller.hintStore.state.hint?.step.slug).toBe('createSprint');
        expect(controller.hintStore.state.open).toBe(true);
    });

    it('resolves a shared slug in the active preset and never calls user-close hooks', async () => {
        const options = getSameStepsOptions({
            availablePresets: ['preset1', 'preset2'],
            activePresets: ['preset2'],
        });
        const wrongClose = vi.fn();
        const onClose = vi.fn();
        const onUserClose = vi.fn();
        options.config.presets.preset1.steps[0].hooks = {onCloseHint: wrongClose};
        options.config.presets.preset2.steps[0].hooks = {
            onCloseHint: onClose,
            onCloseHintByUser: onUserClose,
        };
        const controller = new Controller(options);
        await controller.stepElementReached({stepSlug: 'step1', element: getAnchorElement()});
        await controller.skipStep('step1');

        expect(controller.state.progress?.presetSkippedSteps).toEqual({preset2: ['step1']});
        expect(wrongClose).not.toHaveBeenCalled();
        expect(onUserClose).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalledWith({eventSource: 'stepSkipped'});
        expect(controller.hintStore.state.open).toBe(false);
    });

    it('chooses the active internal preset when only the combined preset is available', async () => {
        const options = getOptionsWithCombined({activePresets: ['internal2']});
        options.config.presets.internal1.steps[0].slug = 'sharedStep';
        options.config.presets.internal2.steps[0].slug = 'sharedStep';
        const controller = new Controller(options);
        await controller.stepElementReached({stepSlug: 'sharedStep', element: getAnchorElement()});

        await controller.skipStep('sharedStep');

        expect(controller.state.progress?.presetSkippedSteps).toEqual({internal2: ['sharedStep']});
        expect(controller.state.progress?.finishedPresets).toEqual(['internal2']);
        expect(controller.hintStore.state.open).toBe(false);
    });

    it('ignores finished shared-slug candidates before choosing an available preset', async () => {
        const options = getSameStepsOptions(
            {availablePresets: ['preset1', 'preset2']},
            {finishedPresets: ['preset1']},
        );
        const controller = new Controller(options);

        await controller.skipStep('step1');

        expect(controller.state.progress?.presetSkippedSteps).toEqual({preset2: ['step1']});
    });

    it('attributes an explicit shared step to its preset without falling back', async () => {
        const options = getSameStepsOptions({
            availablePresets: ['preset1', 'preset2'],
            activePresets: ['preset1'],
        });
        const controller = new Controller(options);
        await controller.skipStep('step1', 'preset2');
        // @ts-expect-error Runtime validation of an unknown preset.
        await controller.skipStep('step2', 'unknownPreset');

        expect(controller.state.progress?.presetSkippedSteps).toEqual({preset2: ['step1']});
    });

    it('does not lose concurrent skips while progress is initially loading', async () => {
        const options = getSkipOptions();
        const controller = new Controller(options);
        await Promise.all([
            controller.skipStep('openBoard'),
            controller.skipStep('createSprint'),
            controller.skipStep('createIssue'),
            controller.skipStep('createIssue'),
            controller.passStep('openBoard'),
        ]);

        expect(options.getProgressState).toHaveBeenCalledOnce();
        expect(controller.state.progress?.presetSkippedSteps?.createProject).toEqual([
            'openBoard',
            'createSprint',
            'createIssue',
        ]);
        expect(options.hooks.stepSkip).toHaveBeenCalledTimes(3);
        expect(options.hooks.stepPass).not.toHaveBeenCalled();
        expect(controller.state.progress?.presetPassedSteps).toEqual({});
        expect(options.hooks.skipPreset).toHaveBeenCalledOnce();
    });

    it('restores skipped progress and clears it when resetting a preset', async () => {
        const options = getSkipOptions({presetSkippedSteps: {createProject: ['openBoard']}});
        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'createSprint',
            element: getAnchorElement(),
        });
        expect(controller.hintStore.state.hint?.step.slug).toBe('createSprint');
        await controller.resetPresetProgress('createProject');

        expect(controller.state.progress?.presetSkippedSteps?.createProject).toBeUndefined();
        expect(controller.state.progress?.presetPassedSteps.createProject).toBeUndefined();
    });

    it('preserves skips and closure of entirely skipped presets during an automatic reset', async () => {
        const options = getSkipOptions({
            presetSkippedSteps: {createProject: ['openBoard', 'createSprint', 'createIssue']},
            finishedPresets: ['createProject'],
        });
        const controller = new Controller(options);
        await controller.resetPresetProgress('createProject', {preserveSkippedSteps: true});
        expect(controller.state.progress?.finishedPresets).toEqual(['createProject']);
        expect(controller.state.progress?.presetSkippedSteps?.createProject).toEqual([
            'openBoard',
            'createSprint',
            'createIssue',
        ]);

        expect(await controller.runPreset('createProject')).toBe(false);
        expect(controller.state.base.activePresets).toEqual([]);

        await controller.resetPresetProgress('createProject');
        expect(controller.state.progress?.finishedPresets).toEqual([]);
        expect(controller.state.progress?.presetSkippedSteps?.createProject).toBeUndefined();
        expect(await controller.runPreset('createProject')).toBe(true);
    });

    it('reopens mixed progress during an automatic reset while preserving its skips', async () => {
        const controller = new Controller(
            getSkipOptions({
                presetSkippedSteps: {createProject: ['openBoard']},
                presetPassedSteps: {createProject: ['createSprint', 'createIssue']},
                finishedPresets: ['createProject'],
            }),
        );
        await controller.resetPresetProgress('createProject', {preserveSkippedSteps: true});

        expect(controller.state.progress?.finishedPresets).toEqual([]);
        expect(controller.state.progress?.presetPassedSteps.createProject).toBeUndefined();
        expect(controller.state.progress?.presetSkippedSteps?.createProject).toEqual(['openBoard']);
    });

    it('going back keeps skipped actions separate and never invents passed actions', async () => {
        const options = getSkipOptions({
            presetPassedSteps: {createProject: ['createSprint']},
            presetSkippedSteps: {createProject: ['openBoard']},
        });
        const controller = new Controller(options);
        await controller.ensureRunning();
        await controller['goPrevStep']('createProject');

        expect(controller.state.progress?.presetPassedSteps.createProject).toEqual([]);
        expect(controller.state.progress?.presetSkippedSteps?.createProject).toEqual(['openBoard']);
        expect(options.hooks.stepPass).not.toHaveBeenCalled();
    });

    it('preserves resolved progress if a terminal listener fails', async () => {
        const options = getSkipOptions();
        options.hooks.skipPreset.mockRejectedValueOnce(new Error('analytics failed'));
        const controller = new Controller(options);
        await controller.skipStep('openBoard');
        await controller.skipStep('createSprint');
        await expect(controller.skipStep('createIssue')).rejects.toThrow('analytics failed');

        expect(options.onSave.progress.mock.lastCall?.[0].finishedPresets).toEqual([
            'createProject',
        ]);
        expect(options.onSave.state.mock.lastCall?.[0].activePresets).toEqual([]);
    });

    it.each(['sync', 'async'])('commits a skip despite a %s step hook error', async (mode) => {
        const options = getSkipOptions();
        const error = new Error('step hook failed');
        const onStepSkip =
            mode === 'sync'
                ? vi.fn(() => {
                      throw error;
                  })
                : vi.fn(async () => {
                      throw error;
                  });
        options.config.presets.createProject.steps =
            options.config.presets.createProject.steps.slice(0, 1);
        options.config.presets.createProject.steps[0].hooks = {onStepSkip};
        const controller = new Controller(options);
        await controller.stepElementReached({stepSlug: 'openBoard', element: getAnchorElement()});

        await expect(controller.skipStep('openBoard')).rejects.toBe(error);

        expect(options.hooks.stepSkip).toHaveBeenCalledOnce();
        expect(options.hooks.skipPreset).toHaveBeenCalledOnce();
        expect(controller.hintStore.state.open).toBe(false);
        expect(options.onSave.progress.mock.lastCall?.[0].presetSkippedSteps).toEqual({
            createProject: ['openBoard'],
        });
        expect(options.onSave.progress.mock.lastCall?.[0].finishedPresets).toEqual([
            'createProject',
        ]);
        await controller.skipStep('openBoard');
        expect(onStepSkip).toHaveBeenCalledOnce();
    });

    it('delivers step notifications before closing the hint despite an earlier failed listener', async () => {
        const options = getSkipOptions();
        options.hooks.stepSkip.mockRejectedValueOnce(new Error('analytics failed'));
        const controller = new Controller(options);
        const calls: string[] = [];
        controller.events.subscribe('stepSkip', async () => {
            await Promise.resolve();
            calls.push('skip');
        });
        controller.events.subscribe('closeHint', () => {
            calls.push('close');
        });
        await controller.stepElementReached({stepSlug: 'openBoard', element: getAnchorElement()});

        await expect(controller.skipStep('openBoard')).rejects.toThrow('analytics failed');

        expect(calls).toEqual(['skip', 'close']);
        expect(options.onSave.progress.mock.lastCall?.[0].presetSkippedSteps).toEqual({
            createProject: ['openBoard'],
        });
    });

    it('closes and commits a skipped hint even if its internal close hook throws', async () => {
        const options = getSkipOptions();
        options.config.presets.createProject.steps =
            options.config.presets.createProject.steps.slice(0, 1);
        options.config.presets.createProject.steps[0].hooks = {
            onCloseHint: () => {
                throw new Error('close hook failed');
            },
        };
        const controller = new Controller(options);
        await controller.stepElementReached({stepSlug: 'openBoard', element: getAnchorElement()});

        await expect(controller.skipStep('openBoard')).rejects.toThrow('close hook failed');

        expect(controller.hintStore.state.open).toBe(false);
        expect(options.hooks.skipPreset).toHaveBeenCalledOnce();
        expect(options.onSave.progress.mock.lastCall?.[0].finishedPresets).toEqual([
            'createProject',
        ]);
    });

    it('checks completion when a remote skip was already recorded and later passes arrive', async () => {
        const options = getSkipOptions({presetSkippedSteps: {createProject: ['createIssue']}});
        const controller = new Controller(options);

        await controller.syncPresetProgress('createProject', {
            passedSteps: ['openBoard', 'createSprint'],
            skippedSteps: ['createIssue'],
        });

        expect(options.hooks.stepSkip).not.toHaveBeenCalled();
        expect(options.hooks.stepPass).not.toHaveBeenCalled();
        expect(options.hooks.finishPreset).toHaveBeenCalledOnce();
        expect(controller.state.progress?.finishedPresets).toEqual(['createProject']);
    });

    it('closes a remotely passed hint before notifying terminal listeners', async () => {
        const options = getSkipOptions();
        const onCloseHintByUser = vi.fn();
        options.config.presets.createProject.steps[0].hooks = {onCloseHintByUser};
        const controller = new Controller(options);
        await controller.stepElementReached({stepSlug: 'openBoard', element: getAnchorElement()});
        controller.events.subscribe('finishPreset', () => {
            expect(controller.hintStore.state.open).toBe(false);
        });

        await controller.syncPresetProgress('createProject', {
            passedSteps: ['openBoard'],
            skippedSteps: ['createSprint', 'createIssue'],
        });

        expect(controller.hintStore.state.open).toBe(false);
        expect(options.hooks.finishPreset).toHaveBeenCalledOnce();
        expect(onCloseHintByUser).not.toHaveBeenCalled();
    });

    it('leaves a hint from another preset open while importing a shared-slug outcome', async () => {
        const options = getSameStepsOptions({
            activePresets: ['preset1'],
            availablePresets: ['preset1', 'preset2'],
        });
        const controller = new Controller(options);
        await controller.stepElementReached({stepSlug: 'step1', element: getAnchorElement()});

        await controller.syncPresetProgress('preset2', {
            passedSteps: ['step1'],
            skippedSteps: ['step2', 'step3'],
        });

        expect(controller.hintStore.state.hint?.preset).toBe('preset1');
        expect(controller.hintStore.state.open).toBe(true);
        expect(controller.state.progress?.finishedPresets).toEqual(['preset2']);
    });

    it('ignores unknown steps and skips no loading when globally disabled', async () => {
        const options = getSkipOptions();
        const controller = new Controller(options);
        await controller.skipStep('unknownStep');
        expect(options.getProgressState).not.toHaveBeenCalled();

        const loader = vi.fn();
        const disabled = new Controller({
            ...options,
            globalSwitch: 'off',
            config: {...options.config, asyncPresets: loader},
        });
        await disabled.skipStep('openBoard');
        await disabled.passOrSkipStep('openBoard');
        await disabled.syncPresetProgress('createProject', {
            passedSteps: ['openBoard'],
            skippedSteps: ['createSprint'],
        });
        expect(loader).not.toHaveBeenCalled();
        expect(options.onSave.progress).not.toHaveBeenCalled();
    });

    it('loads asynchronous presets only once and can skip before they are offered', async () => {
        const options = getSkipOptions();
        const loader = vi.fn(async () => ({
            asyncPreset: {
                name: '',
                steps: [{slug: 'asyncStep', name: '', description: ''}],
            },
        }));
        const controller = new Controller({
            ...options,
            config: {...options.config, asyncPresets: loader},
        } as InitOptions<any, string, string>);

        await controller.skipStep('asyncStep');
        await controller.skipStep('asyncStep');

        expect(loader).toHaveBeenCalledOnce();
        expect(controller.state.progress?.presetSkippedSteps?.asyncPreset).toEqual(['asyncStep']);
        expect(options.hooks.skipPreset).toHaveBeenCalledOnce();
    });
});

describe('remote progress batches', () => {
    it('merges remote progress without overwriting local outcomes or replaying skips', async () => {
        const options = getSkipOptions({
            presetPassedSteps: {createProject: ['openBoard']},
            presetSkippedSteps: {createProject: ['createSprint', 'removedStep']},
        });
        options.config.presets.createProject.steps.push({
            slug: 'remainingStep',
            name: '',
            description: '',
        });
        const onStepSkip = vi.fn();
        for (const step of options.config.presets.createProject.steps) {
            step.hooks = {onStepSkip};
        }
        const controller = new Controller(options);
        const batch = {
            passedSteps: ['createSprint', 'createIssue', 'remainingStep', 'unknownStep'],
            skippedSteps: [
                'openBoard',
                'createSprint',
                'createIssue',
                'createIssue',
                'removedStep',
                'unknownStep',
            ],
        };

        await controller.syncPresetProgress('createProject', batch);
        await controller.syncPresetProgress('createProject', batch);

        expect(controller.state.progress?.presetPassedSteps.createProject).toEqual([
            'openBoard',
            'remainingStep',
        ]);
        expect(controller.state.progress?.presetSkippedSteps?.createProject).toEqual([
            'createSprint',
            'removedStep',
            'createIssue',
        ]);
        expect(onStepSkip).toHaveBeenCalledOnce();
        expect(options.hooks.stepSkip).toHaveBeenCalledExactlyOnceWith(
            {preset: 'createProject', step: 'createIssue'},
            controller,
        );
        expect(options.hooks.stepPass).not.toHaveBeenCalled();
        expect(options.hooks.finishPreset).toHaveBeenCalledOnce();
        expect(options.hooks.skipPreset).not.toHaveBeenCalled();
    });

    it.each([false, true])(
        'shows an already reached next hint after a remote pass (previous hint closed: %s)',
        async (previousHintClosed) => {
            const options = getSkipOptions({
                presetSkippedSteps: {createProject: ['createSprint']},
            });
            const onStepSkip = vi.fn();
            options.config.presets.createProject.steps[1].hooks = {onStepSkip};
            const controller = new Controller(options);
            await controller.stepElementReached({
                stepSlug: 'openBoard',
                element: getAnchorElement(),
            });
            await controller.stepElementReached({
                stepSlug: 'createIssue',
                element: getAnchorElement(),
            });
            expect(controller.hintStore.state.hint?.step.slug).toBe('openBoard');
            if (previousHintClosed) {
                controller.closeHintByUser('openBoard');
            }
            await controller.syncPresetProgress('createProject', {
                passedSteps: ['openBoard'],
                skippedSteps: ['createSprint'],
            });

            expect(controller.hintStore.state.open).toBe(true);
            expect(controller.hintStore.state.hint?.step.slug).toBe('createIssue');
            expect(controller.state.progress?.presetPassedSteps.createProject).toEqual([
                'openBoard',
            ]);
            expect(controller.state.progress?.presetSkippedSteps?.createProject).toEqual([
                'createSprint',
            ]);
            expect(onStepSkip).not.toHaveBeenCalled();
            expect(options.hooks.stepSkip).not.toHaveBeenCalled();
            expect(options.hooks.stepPass).not.toHaveBeenCalled();
        },
    );

    it('saves and notifies state subscribers once for a batch of new skips', async () => {
        const options = getSkipOptions();
        const controller = new Controller(options);
        await controller.ensureRunning();
        const stateChange = vi.fn();
        controller.events.subscribe('stateChange', stateChange);

        await controller.syncPresetProgress('createProject', {
            skippedSteps: ['openBoard', 'createSprint'],
        });

        expect(options.onSave.progress).toHaveBeenCalledOnce();
        expect(stateChange).toHaveBeenCalledOnce();
        expect(options.hooks.stepSkip.mock.calls.map(([{step}]) => step)).toEqual([
            'openBoard',
            'createSprint',
        ]);
        expect(options.hooks.skipPreset).not.toHaveBeenCalled();
        expect(options.hooks.finishPreset).not.toHaveBeenCalled();
    });

    it('saves a batch once after delayed notifications even when another step hook fails', async () => {
        const options = getSkipOptions();
        const error = new Error('batch notification failed');
        const entered = createControlledPromise();
        const delayedHook = createControlledPromise();
        const controller = new Controller(options);
        options.config.presets.createProject.steps[0].hooks = {
            onStepSkip: () => {
                throw error;
            },
        };
        options.config.presets.createProject.steps[1].hooks = {
            onStepSkip: () => {
                expect(controller.state.progress?.presetSkippedSteps?.createProject).toEqual([
                    'openBoard',
                    'createSprint',
                    'createIssue',
                ]);
                entered.resolve();
                return delayedHook.promise;
            },
        };
        await controller.ensureRunning();
        options.hooks.skipPreset.mockImplementation(() => {
            expect(options.hooks.stepSkip).toHaveBeenCalledTimes(3);
        });
        const result = expect(
            controller.syncPresetProgress('createProject', {
                skippedSteps: ['openBoard', 'createSprint', 'createIssue'],
            }),
        ).rejects.toBe(error);
        await entered.promise;
        expect(options.onSave.progress).not.toHaveBeenCalled();
        expect(options.hooks.skipPreset).not.toHaveBeenCalled();

        delayedHook.resolve();
        await result;

        expect(options.onSave.progress).toHaveBeenCalledOnce();
        expect(options.hooks.skipPreset).toHaveBeenCalledOnce();
        expect(
            options.onSave.progress.mock.lastCall?.[0].presetSkippedSteps?.createProject,
        ).toEqual(['openBoard', 'createSprint', 'createIssue']);
        expect(options.onSave.progress.mock.lastCall?.[0].finishedPresets).toEqual([
            'createProject',
        ]);
    });

    it('keeps a manually finished preset closed when late remote skips arrive', async () => {
        const options = getSkipOptions();
        const onStepSkip = vi.fn();
        for (const step of options.config.presets.createProject.steps) {
            step.hooks = {onStepSkip};
        }
        const controller = new Controller(options);
        await controller.finishPreset('createProject');

        await controller.syncPresetProgress('createProject', {
            skippedSteps: ['openBoard', 'createSprint', 'createIssue'],
        });

        expect(controller.getPresetOutcome('createProject')).toBe('finished');
        expect(controller.state.progress?.finishedPresets).toEqual(['createProject']);
        expect(controller.state.progress?.presetSkippedSteps?.createProject).toBeUndefined();
        expect(onStepSkip).not.toHaveBeenCalled();
        expect(options.hooks.stepSkip).not.toHaveBeenCalled();
        expect(options.hooks.skipPreset).not.toHaveBeenCalled();
        expect(options.hooks.finishPreset).toHaveBeenCalledOnce();
    });
});

describe('passOrSkipStep attribution', () => {
    it('passes only when the matching hint is open', async () => {
        const options = getSkipOptions();
        const controller = new Controller(options);
        await controller.stepElementReached({stepSlug: 'openBoard', element: getAnchorElement()});
        await controller.passOrSkipStep('openBoard');

        expect(options.hooks.stepPass).toHaveBeenCalledOnce();
        expect(options.hooks.stepSkip).not.toHaveBeenCalled();
    });

    it('skips when another step is shown, keeping its hint open', async () => {
        const options = getSkipOptions();
        const controller = new Controller(options);
        await controller.stepElementReached({stepSlug: 'openBoard', element: getAnchorElement()});
        await controller.passOrSkipStep('createSprint');

        expect(options.hooks.stepPass).not.toHaveBeenCalled();
        expect(options.hooks.stepSkip).toHaveBeenCalledOnce();
        expect(controller.hintStore.state.hint?.step.slug).toBe('openBoard');
    });
});
