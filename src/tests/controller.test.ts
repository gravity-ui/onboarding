import {Controller} from '../controller';
import {createControlledPromise} from '../debounce';
import type {PresetPersistence} from '../types';
import {getAnchorElement, getOptions, getOptionsWithCombined} from './utils';

const NOW_DATE = new Date(2025, 2, 7);

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

    it('empty base state -> set lastUserActivity=now date', async function () {
        const options = getOptions();
        options.dateNow = () => NOW_DATE;
        // @ts-ignore
        options.baseState = undefined;

        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'openBoard',
            element: getAnchorElement(),
        });

        expect(controller.state.base.lastUserActivity).toBe(NOW_DATE.toUTCString());
    });

    it('base state without lastUserActivity field -> set lastUserActivity=now date', async function () {
        const options = getOptions();
        options.dateNow = () => NOW_DATE;
        // @ts-ignore
        options.baseState = {
            wizardState: 'visible',
            availablePresets: [],
            activePresets: [],
            suggestedPresets: [],
            enabled: true,
        };

        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'openBoard',
            element: getAnchorElement(),
        });

        expect(controller.state.base.lastUserActivity).toBe(NOW_DATE.toUTCString());
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
        const cb = vi.fn();

        controller.subscribe(cb);

        expect(cb).not.toHaveBeenCalled();
    });

    it('load progress -> trigger callback', async function () {
        const options = getOptions();

        const controller = new Controller(options);
        const cb = vi.fn();
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

        const cb = vi.fn();
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

        const cb = vi.fn();
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

        const cb = vi.fn();
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

describe('temporary presets', () => {
    const getTemporaryPresetOptions = (
        persistence: PresetPersistence = 'temporary',
        finalPassMode?: 'onShowHint',
    ) => {
        const options = getOptions();

        return {
            ...options,
            dateNow: () => NOW_DATE,
            config: {
                presets: {
                    ...options.config.presets,
                    temporaryPreset: {
                        name: 'Temporary preset',
                        persistence,
                        steps: [
                            {slug: 'firstHint', name: '', description: ''},
                            {
                                slug: 'secondHint',
                                name: '',
                                description: '',
                                passMode: finalPassMode,
                            },
                        ],
                    },
                },
            },
        };
    };

    it('does not offer temporary presets through suggestions or the wizard', async () => {
        const options = getTemporaryPresetOptions();
        const controller = new Controller(options);

        expect(await controller.suggestPresetOnce('temporaryPreset')).toBe(false);
        expect(controller.userPresets.map(({slug}) => slug)).not.toContain('temporaryPreset');
        await controller.stepElementReached({stepSlug: 'firstHint', element: getAnchorElement()});

        expect(options.showHint).not.toHaveBeenCalled();
        expect(options.onSave.state).not.toHaveBeenCalled();
    });

    it('rejects a suggestion for a combined preset that resolves to a temporary preset', async () => {
        const options = getOptionsWithCombined({activePresets: [], suggestedPresets: []});
        const controller = new Controller({
            ...options,
            dateNow: () => NOW_DATE,
            config: {
                presets: {
                    ...options.config.presets,
                    internal1: {...options.config.presets.internal1, persistence: 'temporary'},
                },
            },
        });
        const onRunPreset = vi.fn();
        controller.events.subscribe('runPreset', onRunPreset);

        expect(await controller.suggestPresetOnce('combinedPreset')).toBe(false);
        expect(onRunPreset).not.toHaveBeenCalled();
    });

    it('starts from the first step when stored progress exists for a preset changed to temporary', async () => {
        const options = getTemporaryPresetOptions();
        options.baseState.availablePresets.push('temporaryPreset');
        options.baseState.activePresets.push('temporaryPreset');
        options.baseState.suggestedPresets.push('temporaryPreset');
        options.getProgressState.mockResolvedValueOnce({
            presetPassedSteps: {createProject: ['openBoard'], temporaryPreset: ['firstHint']},
            finishedPresets: ['createQueue', 'temporaryPreset'],
        });
        const controller = new Controller(options);

        await controller.stepElementReached({stepSlug: 'firstHint', element: getAnchorElement()});
        await controller.stepElementReached({stepSlug: 'secondHint', element: getAnchorElement()});
        expect(options.showHint).not.toHaveBeenCalled();

        expect(await controller.runPreset('temporaryPreset')).toBe(true);
        await controller.stepElementReached({stepSlug: 'firstHint', element: getAnchorElement()});
        expect(controller.hintStore.state.hint?.step.slug).toBe('firstHint');
        expect(options.onSave.progress).toHaveBeenLastCalledWith({
            presetPassedSteps: {createProject: ['openBoard']},
            finishedPresets: ['createQueue'],
        });
    });

    it('keeps steps in memory and saves completion alongside persistent progress', async () => {
        const options = getTemporaryPresetOptions();
        const controller = new Controller(options);
        const page = new AbortController();
        const onCancel = vi.fn();
        controller.events.subscribe('cancelPreset', onCancel);

        expect(await controller.runPreset('temporaryPreset', {signal: page.signal})).toBe(true);
        await controller.stepElementReached({stepSlug: 'firstHint', element: getAnchorElement()});
        expect(controller.hintStore.state.hint?.step.slug).toBe('firstHint');
        await controller.passStep('firstHint');

        await controller.setWizardState('collapsed');
        await controller.passStep('createSprint');

        const snapshot = controller.getSnapshot();
        expect(snapshot.base.activePresets).toContain('temporaryPreset');
        expect(snapshot.progress?.presetPassedSteps.temporaryPreset).toEqual(['firstHint']);
        expect(options.onSave.state).toHaveBeenLastCalledWith(
            expect.objectContaining({
                availablePresets: ['createProject'],
                activePresets: ['createProject'],
                suggestedPresets: ['createProject'],
            }),
        );
        expect(options.onSave.progress).toHaveBeenLastCalledWith({
            presetPassedSteps: {createProject: ['openBoard', 'createSprint']},
            finishedPresets: [],
        });

        await controller.stepElementReached({stepSlug: 'secondHint', element: getAnchorElement()});
        expect(controller.hintStore.state.hint?.step.slug).toBe('secondHint');
        await controller.passStep('secondHint');
        page.abort();

        expect(options.onSave.progress).toHaveBeenLastCalledWith({
            presetPassedSteps: {createProject: ['openBoard', 'createSprint']},
            finishedPresets: ['temporaryPreset'],
        });
        expect(onCancel).not.toHaveBeenCalled();

        expect(await controller.runPreset('temporaryPreset')).toBe(true);
        await controller.stepElementReached({stepSlug: 'firstHint', element: getAnchorElement()});
        expect(controller.hintStore.state.hint?.step.slug).toBe('firstHint');
        expect(controller.state.progress?.finishedPresets).toEqual([]);
        expect(options.onSave.progress).toHaveBeenLastCalledWith({
            presetPassedSteps: {createProject: ['openBoard', 'createSprint']},
            finishedPresets: [],
        });
    });

    it.each(['persistent', 'temporary'] as const)(
        'finishes a %s preset as soon as its final auto-passed hint is shown',
        async (persistence) => {
            const options = getTemporaryPresetOptions(persistence, 'onShowHint');
            const controller = new Controller(options);
            const onFinish = vi.fn();
            controller.events.subscribe('finishPreset', () => {
                const {base, progress} = controller.getSnapshot();

                onFinish({
                    active: base.activePresets.includes('temporaryPreset'),
                    finished: progress?.finishedPresets.includes('temporaryPreset'),
                    hintOpen: controller.hintStore.state.open,
                });
            });

            await controller.runPreset('temporaryPreset');
            await controller.stepElementReached({
                stepSlug: 'firstHint',
                element: getAnchorElement(),
            });
            await controller.passStep('firstHint');
            await controller.stepElementReached({
                stepSlug: 'secondHint',
                element: getAnchorElement(),
            });

            expect(onFinish).toHaveBeenCalledExactlyOnceWith({
                active: true,
                finished: false,
                hintOpen: true,
            });
            expect(controller.getSnapshot().base.activePresets).not.toContain('temporaryPreset');
            expect(controller.hintStore.state.hint?.step.slug).toBe('secondHint');
            expect(controller.hintStore.state.open).toBe(true);
            expect(options.onSave.progress).toHaveBeenLastCalledWith({
                presetPassedSteps:
                    persistence === 'temporary'
                        ? {createProject: ['openBoard']}
                        : {
                              createProject: ['openBoard'],
                              temporaryPreset: ['firstHint', 'secondHint'],
                          },
                finishedPresets: ['temporaryPreset'],
            });

            controller.closeHint();

            expect(onFinish).toHaveBeenCalledTimes(1);
        },
    );

    it('restarts the active temporary run and detaches its previous signal', async () => {
        const options = getTemporaryPresetOptions();
        const controller = new Controller(options);
        const initialRun = new AbortController();
        const replacementRun = new AbortController();

        await controller.runPreset('temporaryPreset', {signal: initialRun.signal});
        await controller.stepElementReached({stepSlug: 'firstHint', element: getAnchorElement()});
        await controller.passStep('firstHint');
        await controller.stepElementReached({stepSlug: 'secondHint', element: getAnchorElement()});

        expect(await controller.suggestPresetOnce('temporaryPreset')).toBe(false);
        expect(await controller.runPreset('temporaryPreset', {signal: AbortSignal.abort()})).toBe(
            false,
        );
        expect(controller.hintStore.state.hint?.step.slug).toBe('secondHint');
        expect(await controller.runPreset('temporaryPreset', {signal: replacementRun.signal})).toBe(
            true,
        );
        await controller.stepElementReached({stepSlug: 'firstHint', element: getAnchorElement()});
        expect(controller.hintStore.state.hint?.step.slug).toBe('firstHint');

        initialRun.abort();

        expect(controller.hintStore.state.open).toBe(true);
        expect(controller.hintStore.state.hint?.step.slug).toBe('firstHint');

        replacementRun.abort();

        expect(controller.hintStore.state.open).toBe(false);
        expect(controller.state.progress?.finishedPresets).toEqual([]);
    });

    it('ignores a start hook that resolves after a newer direct run has passed a step', async () => {
        const options = getTemporaryPresetOptions();
        const preparing = createControlledPromise();
        const prepared = createControlledPromise();
        const onBeforeStart = vi.fn().mockImplementationOnce(async () => {
            preparing.resolve();
            await prepared.promise;
        });
        const controller = new Controller({
            ...options,
            config: {
                presets: {
                    ...options.config.presets,
                    temporaryPreset: {
                        ...options.config.presets.temporaryPreset,
                        hooks: {onBeforeStart},
                    },
                },
            },
        });

        const olderRun = controller.runPreset('temporaryPreset');
        await preparing.promise;
        expect(await controller.runPreset('temporaryPreset')).toBe(true);
        await controller.stepElementReached({stepSlug: 'firstHint', element: getAnchorElement()});
        await controller.passStep('firstHint');
        await controller.stepElementReached({stepSlug: 'secondHint', element: getAnchorElement()});

        prepared.resolve();

        expect(await olderRun).toBe(false);
        expect(controller.hintStore.state.hint?.step.slug).toBe('secondHint');
    });

    it('ignores a combined selection that resolves after a newer run of its temporary leaf', async () => {
        const options = getOptionsWithCombined({activePresets: [], suggestedPresets: []});
        const picking = createControlledPromise();
        const selected = createControlledPromise();
        const controller = new Controller({
            ...options,
            dateNow: () => NOW_DATE,
            config: {
                presets: {
                    ...options.config.presets,
                    combinedPreset: {
                        ...options.config.presets.combinedPreset,
                        pickPreset: async () => {
                            picking.resolve();
                            await selected.promise;
                            return 'internal1';
                        },
                    },
                    internal1: {...options.config.presets.internal1, persistence: 'temporary'},
                },
            },
        });

        const olderRun = controller.runPreset('combinedPreset');
        await picking.promise;
        expect(await controller.runPreset('internal1')).toBe(true);
        await controller.stepElementReached({
            stepSlug: 'someStepInternal11',
            element: getAnchorElement(),
        });
        await controller.passStep('someStepInternal11');
        await controller.stepElementReached({
            stepSlug: 'someStepInternal12',
            element: getAnchorElement(),
        });

        selected.resolve();

        expect(await olderRun).toBe(false);
        expect(controller.hintStore.state.hint?.step.slug).toBe('someStepInternal12');
    });

    it('discards an aborted run so the next direct run starts at the first step', async () => {
        const options = getTemporaryPresetOptions();
        const controller = new Controller(options);
        const page = new AbortController();
        const onCancel = vi.fn();
        controller.events.subscribe('cancelPreset', onCancel);

        await controller.runPreset('temporaryPreset', {signal: page.signal});
        await controller.stepElementReached({stepSlug: 'firstHint', element: getAnchorElement()});
        await controller.passStep('firstHint');
        await controller.stepElementReached({stepSlug: 'secondHint', element: getAnchorElement()});
        expect(controller.hintStore.state.hint?.step.slug).toBe('secondHint');

        page.abort();

        expect(controller.hintStore.state.open).toBe(false);
        expect(onCancel).toHaveBeenCalledWith({preset: 'temporaryPreset'}, controller);
        const snapshot = controller.getSnapshot();
        expect(snapshot.base.activePresets).not.toContain('temporaryPreset');
        expect(snapshot.progress?.presetPassedSteps).not.toHaveProperty('temporaryPreset');
        expect(snapshot.progress?.finishedPresets).toEqual([]);

        expect(await controller.runPreset('temporaryPreset')).toBe(true);
        await controller.stepElementReached({stepSlug: 'firstHint', element: getAnchorElement()});
        expect(controller.hintStore.state.hint?.step.slug).toBe('firstHint');
    });

    it('does not show a hint when its temporary run is aborted during preparation', async () => {
        const options = getTemporaryPresetOptions();
        const controller = new Controller(options);
        const page = new AbortController();
        const preparing = createControlledPromise();
        const prepared = createControlledPromise();

        controller.events.subscribe('beforeShowHint', async () => {
            preparing.resolve();
            await prepared.promise;
        });

        await controller.runPreset('temporaryPreset', {signal: page.signal});
        const showHint = controller.stepElementReached({
            stepSlug: 'firstHint',
            element: getAnchorElement(),
        });
        await preparing.promise;

        page.abort();
        prepared.resolve();
        await showHint;

        expect(options.showHint).not.toHaveBeenCalled();
        expect(controller.hintStore.state.open).toBe(false);
    });
});

describe('wrong data', function () {
    it('add not existed preset', async function () {
        const options = getOptions();
        const controller = new Controller(options);
        options.logger.logger.error.mockClear();

        await controller.addPreset('unknownPreset');

        expect(options.logger.logger.error).not.toHaveBeenCalled();
    });

    it('suggest not existed preset -> error', async function () {
        expect.assertions(2);

        const options = getOptions();
        const controller = new Controller(options);
        options.logger.logger.error.mockClear();

        try {
            await controller.suggestPresetOnce('unknownPreset');
        } catch (e: unknown) {
            // @ts-ignore
            expect(e.message).toBe('No preset in config');

            expect(options.logger.logger.error).toHaveBeenCalled();
        }
    });

    it('run not existed preset -> throw error', async function () {
        expect.assertions(1);

        const options = getOptions();
        const controller = new Controller(options);
        options.logger.logger.error.mockClear();

        try {
            await controller.runPreset('unknownPreset');
        } catch {
            expect(options.logger.logger.error).toHaveBeenCalled();
        }
    });

    it('reach not existed step', async function () {
        const options = getOptions();
        const controller = new Controller(options);
        options.logger.logger.error.mockClear();

        await controller.stepElementReached({
            element: getAnchorElement(),
            stepSlug: 'unknownStep',
        });

        expect(options.logger.logger.error).not.toHaveBeenCalled();
    });

    it('pass not existed step', async function () {
        const options = getOptions();
        const controller = new Controller(options);
        options.logger.logger.error.mockClear();

        await controller.passStep('unknownStep');

        expect(options.logger.logger.error).not.toHaveBeenCalled();
    });

    describe('ignoreUnknownPresets=true', () => {
        const prepareOptions = () => {
            const options = getOptions();
            options.ignoreUnknownPresets = true;

            return options;
        };
        let options = prepareOptions();

        beforeEach(() => {
            options = prepareOptions();
        });

        it('run preset -> nothing', async function () {
            const controller = new Controller(options);

            const result = await controller.runPreset('createQueue123');

            expect(result).toBe(false);
            expect(options.onSave.state).not.toHaveBeenCalled();
            expect(options.onSave.progress).not.toHaveBeenCalled();
        });

        it('suggest not existed preset -> false', async function () {
            const controller = new Controller(options);
            options.logger.logger.error.mockClear();

            const result = await controller.suggestPresetOnce('unknownPreset');

            expect(result).toBe(false);
            expect(options.logger.logger.error).toHaveBeenCalled();
        });

        it('run not existed preset -> return false', async function () {
            const controller = new Controller(options);
            options.logger.logger.error.mockClear();

            const result = await controller.runPreset('unknownPreset');

            expect(result).toBe(false);
            expect(options.logger.logger.error).toHaveBeenCalled();
        });
    });
});

it('resetToDefaultState -> hidden and empty ', async function () {
    const options = getOptions();
    options.dateNow = () => NOW_DATE;

    const controller = new Controller(options);
    await controller.ensureRunning();

    await controller.resetToDefaultState();

    expect(controller.state).toEqual({
        base: {
            activePresets: [],
            availablePresets: [],
            suggestedPresets: [],
            wizardState: 'hidden',
            enabled: false,
            lastUserActivity: NOW_DATE.toUTCString(),
        },
        progress: {
            finishedPresets: [],
            presetPassedSteps: {},
        },
    });
});

it('set onboarding state = false', async function () {
    const options = getOptions();

    const controller = new Controller(options);
    await controller.setOnboardingEnabled(false);

    const newState = options.onSave.state.mock.calls[options.onSave.state.mock.calls.length - 1][0];

    expect(controller.state.base.enabled).toBe(false);
    expect(newState.enabled).toBe(false);
});

it('set onboarding state = true', async function () {
    const options = getOptions({enabled: false});

    const controller = new Controller(options);
    await controller.setOnboardingEnabled(true);

    const newState = options.onSave.state.mock.calls[options.onSave.state.mock.calls.length - 1][0];

    expect(controller.state.base.enabled).toBe(true);
    expect(newState.enabled).toBe(true);
});

describe('goNextStep and goNextStep', function () {
    it('goNextStep -> pass next step in preset', async function () {
        const options = getOptions();
        const controller = new Controller(options);

        await controller.ensureRunning();
        await controller['goNextStep']('createProject');

        expect(controller.state.progress?.presetPassedSteps.createProject).toEqual([
            'openBoard',
            'createSprint',
        ]);
    });

    describe('goPrevStep', function () {
        it('goPrevStep -> delete step from presetPassedSteps', async function () {
            const options = getOptions(
                {},
                {
                    presetPassedSteps: {
                        createProject: ['openBoard', 'createSprint'],
                    },
                },
            );
            const controller = new Controller(options);

            await controller.ensureRunning();
            await controller['goPrevStep']('createProject');

            expect(controller.state.progress?.presetPassedSteps.createProject).toEqual([
                'openBoard',
            ]);
        });

        it('goPrevStep -> show previous hint', async function () {
            const options = getOptions(
                {},
                {
                    presetPassedSteps: {
                        createProject: ['openBoard', 'createSprint'],
                    },
                },
            );
            const controller = new Controller(options);

            await controller.stepElementReached({
                stepSlug: 'createSprint',
                element: getAnchorElement(),
            });

            await controller['goPrevStep']('createProject');

            expect(controller.hintStore.state.open).toBe(true);
            expect(controller.hintStore.state.hint?.step.slug).toBe('createSprint');
        });

        it('no passed steps -> empty list', async function () {
            const options = getOptions(
                {},
                {
                    presetPassedSteps: {},
                },
            );
            const controller = new Controller(options);

            await controller.ensureRunning();
            await controller['goPrevStep']('createProject');

            expect(controller.state.progress?.presetPassedSteps.createProject).toBe(undefined);
        });

        it('skipped step -> add skipped step', async function () {
            const options = getOptions(
                {},
                {
                    presetPassedSteps: {
                        createProject: ['openBoard', 'createIssue'],
                    },
                },
            );
            const controller = new Controller(options);

            await controller.ensureRunning();
            await controller['goPrevStep']('createProject');

            expect(controller.state.progress?.presetPassedSteps.createProject).toEqual([
                'openBoard',
                'createSprint',
            ]);
        });

        it('skipped first step -> add skipped step', async function () {
            const options = getOptions(
                {},
                {
                    presetPassedSteps: {
                        createProject: ['createIssue'],
                    },
                },
            );
            const controller = new Controller(options);

            await controller.ensureRunning();
            await controller['goPrevStep']('createProject');

            expect(controller.state.progress?.presetPassedSteps.createProject).toEqual([
                'openBoard',
                'createSprint',
            ]);
        });

        describe('combine with other actions', function () {
            it('passed only first step -> empty list', async function () {
                const options = getOptions(
                    {},
                    {
                        presetPassedSteps: {
                            createProject: ['openBoard'],
                        },
                    },
                );
                const controller = new Controller(options);

                await controller.ensureRunning();
                await controller['goPrevStep']('createProject');

                expect(controller.state.progress?.presetPassedSteps.createProject).toEqual([]);
            });

            it('pass step, goPrevStep -> show previous hint', async function () {
                // Timers can finish before Date.now advances by the debounce interval.
                const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now());
                try {
                    const options = getOptions(
                        {},
                        {
                            presetPassedSteps: {
                                createProject: ['openBoard'],
                            },
                        },
                    );
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

                    await controller.ensureRunning();
                    await controller['goPrevStep']('createProject');

                    expect(controller.hintStore.state.open).toBe(true);
                    expect(controller.hintStore.state.hint?.step.slug).toBe('createSprint');
                } finally {
                    clock.mockRestore();
                }
            });

            it('goPrevStep, pass step -> show initial hint', async function () {
                const options = getOptions(
                    {},
                    {
                        presetPassedSteps: {
                            createProject: ['openBoard'],
                        },
                    },
                );
                const controller = new Controller(options);

                await controller.stepElementReached({
                    stepSlug: 'openBoard',
                    element: getAnchorElement(),
                });
                await controller.stepElementReached({
                    stepSlug: 'createSprint',
                    element: getAnchorElement(),
                });

                await controller['goPrevStep']('createProject');
                await controller.passStep('openBoard');

                expect(controller.hintStore.state.open).toBe(true);
                expect(controller.hintStore.state.hint?.step.slug).toBe('createSprint');
            });

            it('goPrevStep, goNextStep -> show initial hint', async function () {
                const options = getOptions(
                    {},
                    {
                        presetPassedSteps: {
                            createProject: ['openBoard'],
                        },
                    },
                );
                const controller = new Controller(options);

                await controller.stepElementReached({
                    stepSlug: 'openBoard',
                    element: getAnchorElement(),
                });
                await controller.stepElementReached({
                    stepSlug: 'createSprint',
                    element: getAnchorElement(),
                });

                expect(controller.hintStore.state.open).toBe(true);
                expect(controller.hintStore.state.hint?.step.slug).toBe('createSprint');

                const promise1 = controller['goPrevStep']('createProject');
                const promise2 = controller['goNextStep']('createProject');

                await Promise.all([promise1, promise2]);

                expect(controller.hintStore.state.open).toBe(true);
                expect(controller.hintStore.state.hint?.step.slug).toBe('createSprint');
            });
        });
    });
});

describe('custom default state', () => {
    it('can use empty custom state', () => {
        const options = getOptions();
        options.dateNow = () => NOW_DATE;
        // @ts-ignore
        options.baseState = {};
        options.customDefaultState = {};

        const controller = new Controller(options);
        expect(controller.state.base).toEqual({
            wizardState: 'hidden',
            enabled: false,
            activePresets: [],
            availablePresets: [],
            suggestedPresets: [],
            lastUserActivity: NOW_DATE.toUTCString(),
        });
    });

    it('can apply custom state', () => {
        const options = getOptions();
        options.customDefaultState = {
            wizardState: 'visible',
            enabled: true,
        };

        const controller = new Controller(options);
        expect(controller.state.base.wizardState).toBe('visible');
        expect(controller.state.base.enabled).toBe(true);
    });

    it('has saved value -> dont apply custom default', () => {
        const options = getOptions({wizardState: 'collapsed'});
        options.customDefaultState = {
            wizardState: 'visible',
        };

        const controller = new Controller(options);
        expect(controller.state.base.wizardState).toBe('collapsed');
    });

    it('resetToDefaultState() -> apply custom default', async () => {
        const options = getOptions();
        options.customDefaultState = {
            wizardState: 'visible',
            enabled: true,
        };

        const controller = new Controller(options);
        await controller.resetToDefaultState();

        expect(controller.state.base.wizardState).toBe('visible');
        expect(controller.state.base.enabled).toBe(true);
    });
});

describe('progressState init', function () {
    it('init -> call getProgressState ', async function () {
        const options = getOptions();

        const controller = new Controller(options);
        await controller.ensureRunning();

        expect(options.getProgressState).toHaveBeenCalled();
    });

    it('has progressState in options -> dont call getProgressState ', async function () {
        const options = getOptions();
        // @ts-ignore
        options.progressState = {
            presetPassedSteps: {},
            finishedPresets: [],
        };

        const controller = new Controller(options);
        await controller.ensureRunning();

        expect(options.getProgressState).not.toHaveBeenCalled();
    });

    it('has progressState in options -> use progressState value', async function () {
        const options = getOptions();
        const progressState = {
            presetPassedSteps: {},
            finishedPresets: [],
        };
        // @ts-ignore
        options.progressState = progressState;

        const controller = new Controller(options);
        await controller.ensureRunning();

        expect(controller.state.progress).toEqual(progressState);
    });
});

describe('global switch = off. No requests. No errors', () => {
    it('init', async () => {
        const options = getOptions();
        // @ts-ignore
        options.globalSwitch = 'off';

        const controller = new Controller(options);
        await controller.ensureRunning();

        expect(options.getProgressState).not.toHaveBeenCalled();
        expect(options.onSave.state).not.toHaveBeenCalled();
        expect(options.onSave.progress).not.toHaveBeenCalled();
    });

    it('reach element', async () => {
        const options = getOptions();
        // @ts-ignore
        options.globalSwitch = 'off';

        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'createSprint',
            element: getAnchorElement(),
        });

        expect(options.getProgressState).not.toHaveBeenCalled();
        expect(options.onSave.state).not.toHaveBeenCalled();
        expect(options.onSave.progress).not.toHaveBeenCalled();
    });

    it('pass step', async () => {
        const options = getOptions();
        // @ts-ignore
        options.globalSwitch = 'off';

        const controller = new Controller(options);
        await controller.passStep('createSprint');

        expect(options.getProgressState).not.toHaveBeenCalled();
        expect(options.onSave.state).not.toHaveBeenCalled();
        expect(options.onSave.progress).not.toHaveBeenCalled();
    });

    it('add preset', async () => {
        const options = getOptions();
        // @ts-ignore
        options.globalSwitch = 'off';

        const controller = new Controller(options);
        await controller.addPreset('createQueue');

        expect(options.getProgressState).not.toHaveBeenCalled();
        expect(options.onSave.state).not.toHaveBeenCalled();
        expect(options.onSave.progress).not.toHaveBeenCalled();
    });

    it('run preset', async () => {
        const options = getOptions();
        // @ts-ignore
        options.globalSwitch = 'off';

        const controller = new Controller(options);
        await controller.runPreset('createQueue');

        expect(options.getProgressState).not.toHaveBeenCalled();
        expect(options.onSave.state).not.toHaveBeenCalled();
        expect(options.onSave.progress).not.toHaveBeenCalled();
    });

    it('suggest preset', async () => {
        const options = getOptions();
        // @ts-ignore
        options.globalSwitch = 'off';

        const controller = new Controller(options);
        await controller.runPreset('createQueue');

        expect(options.getProgressState).not.toHaveBeenCalled();
        expect(options.onSave.state).not.toHaveBeenCalled();
        expect(options.onSave.progress).not.toHaveBeenCalled();
    });

    it('run preset', async () => {
        const options = getOptions();
        // @ts-ignore
        options.globalSwitch = 'off';

        const controller = new Controller(options);
        await controller.runPreset('createProject');

        expect(options.getProgressState).not.toHaveBeenCalled();
        expect(options.onSave.state).not.toHaveBeenCalled();
        expect(options.onSave.progress).not.toHaveBeenCalled();
    });

    it('finish preset', async () => {
        const options = getOptions();
        // @ts-ignore
        options.globalSwitch = 'off';

        const controller = new Controller(options);
        await controller.runPreset('createProject');

        expect(options.getProgressState).not.toHaveBeenCalled();
        expect(options.onSave.state).not.toHaveBeenCalled();
        expect(options.onSave.progress).not.toHaveBeenCalled();
    });

    it('setWizard', async () => {
        const options = getOptions();
        // @ts-ignore
        options.globalSwitch = 'off';

        const controller = new Controller(options);
        await controller.setWizardState('hidden');

        expect(options.getProgressState).not.toHaveBeenCalled();
        expect(options.onSave.state).not.toHaveBeenCalled();
        expect(options.onSave.progress).not.toHaveBeenCalled();
    });

    it('setEnabled', async () => {
        const options = getOptions();
        // @ts-ignore
        options.globalSwitch = 'off';

        const controller = new Controller(options);
        await controller.setOnboardingEnabled(false);

        expect(options.getProgressState).not.toHaveBeenCalled();
        expect(options.onSave.state).not.toHaveBeenCalled();
        expect(options.onSave.progress).not.toHaveBeenCalled();
    });

    it('resetPresetProgress', async () => {
        const options = getOptions();
        // @ts-ignore
        options.globalSwitch = 'off';

        const controller = new Controller(options);
        await controller.resetPresetProgress('createProject');

        expect(options.getProgressState).not.toHaveBeenCalled();
        expect(options.onSave.state).not.toHaveBeenCalled();
        expect(options.onSave.progress).not.toHaveBeenCalled();
    });
});
