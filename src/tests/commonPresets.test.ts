import {Controller} from '../controller';
import {getAnchorElement, getOptions, getOptionsWithHooks, waitForNextTick} from './utils';
import {createControlledPromise} from '../debounce';

describe('preset management', function () {
    describe('add preset', function () {
        it('add preset -> save base state', async function () {
            const options = getOptions();

            const controller = new Controller(options);
            await controller.addPreset('createQueue');

            const newState = options.onSave.state.mock.calls[0][0];

            expect(newState.availablePresets).toEqual(['createProject', 'createQueue']);
        });

        it('add same preset -> not duplicate', async function () {
            const options = getOptions();

            const controller = new Controller(options);
            await controller.addPreset('createQueue');
            await controller.addPreset('createQueue');

            const newState =
                options.onSave.state.mock.calls[options.onSave.state.mock.calls.length - 1][0];

            expect(newState.availablePresets).toContain('createQueue');
        });

        it('preset not from config -> nothing', async function () {
            const options = getOptions();

            const controller = new Controller(options);

            await controller.addPreset('createQueue123');
            expect(options.onSave.state).not.toHaveBeenCalled();
            expect(options.onSave.progress).not.toHaveBeenCalled();
        });

        it('add preset -> calls onAddPreset', async function () {
            const options = getOptionsWithHooks();

            const controller = new Controller(options);
            await controller.addPreset('createQueue');

            expect(options.hooks.onAddPreset).toHaveBeenCalledWith({
                preset: 'createQueue',
            });
        });
    });

    describe('run preset', function () {
        let options = getOptions({availablePresets: ['createProject', 'createBoard']});

        beforeEach(() => {
            options = getOptions({availablePresets: ['createProject', 'createBoard']});
        });

        it('run preset -> adds in active and suggested presets', async function () {
            const controller = new Controller(options);
            await controller.runPreset('createQueue');

            const newState = options.onSave.state.mock.calls[0][0];

            expect(newState.activePresets).toEqual(['createProject', 'createQueue']);
            expect(newState.suggestedPresets).toEqual(['createProject', 'createQueue']);
        });

        it('run same preset -> not duplicate', async function () {
            const controller = new Controller(options);
            await controller.runPreset('createQueue');
            await controller.finishPreset('createQueue');
            await controller.runPreset('createQueue');

            const newState =
                options.onSave.state.mock.calls[options.onSave.state.mock.calls.length - 1][0];

            expect(newState.activePresets).toEqual(['createProject', 'createQueue']);
            expect(newState.suggestedPresets).toEqual(['createProject', 'createQueue']);
        });

        it('preset not from config -> nothing', async function () {
            const controller = new Controller(options);

            expect(controller.runPreset('createQueue123')).rejects.toThrow();
            expect(options.onSave.state).not.toHaveBeenCalled();
            expect(options.onSave.progress).not.toHaveBeenCalled();
        });

        it('run preset -> show hint for existing element', async function () {
            options.baseState.activePresets = [];

            const controller = new Controller(options);
            await controller.stepElementReached({
                stepSlug: 'createSprint',
                element: getAnchorElement(),
            });

            await controller.runPreset('createProject');
            await waitForNextTick();

            await expect(options.showHint).toHaveBeenCalled();
        });

        it('can run unavailable preset', async function () {
            const controller = new Controller(options);
            await controller.runPreset('createQueue');

            const newState = options.onSave.state.mock.calls[0][0];

            expect(newState.availablePresets).toContain('createQueue');
            expect(newState.activePresets).toContain('createQueue');
        });
    });

    describe('hooks', function () {
        it('calls onBeforeStart -> before run preset', async function () {
            expect.assertions(1);
            const options = getOptionsWithHooks();

            const controller = new Controller(options);
            const mock = () => {
                expect(controller.state.base.activePresets).not.toContain('createQueue');
            };
            // @ts-ignore
            options.config.presets.createQueue.hooks = {onBeforeStart: mock};
            await controller.runPreset('createQueue');
        });

        it('can await onBeforeStart hook', async function () {
            const {promise, resolve} = createControlledPromise();
            const options = getOptionsWithHooks();

            const controller = new Controller(options);
            // @ts-ignore
            options.config.presets.createQueue.hooks = {onBeforeStart: () => promise};
            const runPresetPromise = controller.runPreset('createQueue');

            expect(controller.state.base.activePresets).not.toContain('createQueue');
            resolve();

            await runPresetPromise;
            expect(controller.state.base.activePresets).toContain('createQueue');
        });

        it('start preset -> calls onStart', async function () {
            const options = getOptionsWithHooks();
            const mock = jest.fn();
            // @ts-ignore
            options.config.presets.createQueue.hooks = {onStart: mock};

            const controller = new Controller(options);
            await controller.runPreset('createQueue');

            expect(mock).toHaveBeenCalled();
        });

        it('onStart hook called -> has preset in active', async function () {
            const options = getOptionsWithHooks();

            const controller = new Controller(options);
            const mock = jest.fn(() => {
                expect(controller.state.base.activePresets).toContain('createQueue');
            });
            // @ts-ignore
            options.config.presets.createQueue.hooks = {onStart: mock};

            await controller.runPreset('createQueue');

            expect(mock).toHaveBeenCalled();
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
    });

    it('restart preset -> show hint for existing element', async function () {
        const options = getOptions(
            {
                activePresets: [],
            },
            {
                presetPassedSteps: {},
            },
        );

        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'openBoard',
            element: getAnchorElement(),
        });

        await controller.runPreset('createProject');
        await controller.resetPresetProgress('createProject');
        await controller.runPreset('createProject');
        await waitForNextTick();

        await expect(options.showHint).toHaveBeenCalledTimes(2);
    });

    describe('finish preset', function () {
        it('finish same preset -> not duplicate', async function () {
            const options = getOptions();

            const controller = new Controller(options);
            await controller.finishPreset('createProject');
            await controller.finishPreset('createProject');

            const newProgressState = options.onSave.progress.mock.calls[1][0];

            expect(newProgressState.finishedPresets).toEqual(['createProject']);
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

        it('finish preset -> stay in suggested', async function () {
            const options = getOptions();

            const controller = new Controller(options);
            await controller.finishPreset('createProject');

            const newBaseState = options.onSave.state.mock.calls[0][0];

            expect(newBaseState.suggestedPresets).toEqual(['createProject']);
        });

        it('finish unavailable preset -> add to finished', async function () {
            const options = getOptions({activePresets: [], availablePresets: []});
            const controller = new Controller(options);
            await controller.finishPreset('createQueue');

            const newBaseState = options.onSave.state.mock.calls[0][0];
            const newProgressState = options.onSave.progress.mock.calls[0][0];

            expect(newBaseState.activePresets).toEqual([]);
            expect(newProgressState.finishedPresets).toEqual(['createQueue']);
        });
    });

    describe('finish preset by pass steps', function () {
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

        it('pass only last steps -> finish preset', async function () {
            const options = getOptionsWithHooks({}, {presetPassedSteps: {createProject: []}});

            const controller = new Controller(options);
            await controller.passStep('createSprint');
            await controller.passStep('createIssue');

            const newProgressState = options.onSave.progress.mock.lastCall[0];

            expect(newProgressState.finishedPresets).toContain('createProject');
        });

        it('finish preset by pass step -> hide hint', async function () {
            const options = getOptionsWithHooks(
                {},
                {presetPassedSteps: {createProject: ['createSprint']}},
            );

            const controller = new Controller(options);
            await controller.stepElementReached({
                stepSlug: 'openBoard',
                element: getAnchorElement(),
            });
            await controller.stepElementReached({
                stepSlug: 'createIssue',
                element: getAnchorElement(),
            });
            await controller.passStep('createIssue');
            await waitForNextTick();

            expect(controller.hintStore.state.open).toBe(false);
        });
    });

    describe('reset progress', function () {
        it('remove progress, remove from finished', async function () {
            const options = getOptions({}, {finishedPresets: ['createQueue']});

            const controller = new Controller(options);
            await controller.resetPresetProgress(['createProject', 'createQueue']);

            const newProgressState = options.onSave.progress.mock.calls[0][0];

            // remove createQueue from finished
            expect(newProgressState.finishedPresets).toEqual([]);

            // remove createProject passed steps
            expect(newProgressState.presetPassedSteps.createProject).toBeUndefined();

            const newBaseState = options.onSave.state.mock.calls[0][0];
            // remove createProject from suggested presets
            expect(newBaseState.activePresets).toEqual([]);
        });
    });
});

describe('suggest once', function () {
    it('first preset run -> runs', async function () {
        const options = getOptions({wizardState: 'hidden'});

        const controller = new Controller(options);
        await controller.suggestPresetOnce('createQueue');

        const newState = options.onSave.state.mock.calls[0][0];

        expect(newState.wizardState).toBe('visible');
    });

    it('call -> add preset', async function () {
        const options = getOptions();

        const controller = new Controller(options);
        await controller.suggestPresetOnce('createQueue');

        const newState = options.onSave.state.mock.calls[0][0];

        expect(newState.activePresets).toEqual(['createProject', 'createQueue']);
    });

    it('second run -> nothing', async function () {
        const options = getOptions({wizardState: 'hidden'});

        const controller = new Controller(options);
        await controller.suggestPresetOnce('createQueue');
        await controller.setWizardState('hidden');

        await controller.suggestPresetOnce('createQueue');

        expect(controller.state.base.wizardState).toBe('hidden');
    });

    it('call -> use different wizard state', async function () {
        const options = getOptions({wizardState: 'hidden'});

        const controller = new Controller(options);
        await controller.suggestPresetOnce('createQueue', 'invisible');

        const newState = options.onSave.state.mock.calls[0][0];

        expect(newState.wizardState).toBe('invisible');
    });
});

describe('user presets', function () {
    it('no progress -> all config presets ', function () {
        const options = getOptions(
            {activePresets: [], availablePresets: []},
            {finishedPresets: []},
        );

        const controller = new Controller(options);
        expect(controller.userPresets).toHaveLength(2);
    });

    it('deleted presets in active and finished', async function () {
        const options = getOptions(
            {activePresets: ['deleted1'], availablePresets: [], wizardState: 'visible'},
            {finishedPresets: ['deleted2']},
        );
        // @ts-ignore
        options.config.presets.createProject.visibility = 'initialHidden';

        const controller = new Controller(options);
        await waitForNextTick(); // progress loading

        expect(controller.userPresets).toHaveLength(1);
    });

    describe('initial hidden preset', function () {
        it('dont count hidden presets', function () {
            const options = getOptions(
                {activePresets: [], availablePresets: []},
                {finishedPresets: []},
            );
            // @ts-ignore
            options.config.presets.createProject.visibility = 'initialHidden';

            const controller = new Controller(options);
            const presetSlugs = controller.userPresets.map(({slug}) => slug);

            expect(presetSlugs).not.toContain('createProject');
        });

        it('pick hidden + available preset', function () {
            const options = getOptions(
                {activePresets: [], availablePresets: ['createProject']},
                {finishedPresets: []},
            );
            // @ts-ignore
            options.config.presets.createProject.visibility = 'initialHidden';

            const controller = new Controller(options);
            const presetSlugs = controller.userPresets.map(({slug}) => slug);

            expect(presetSlugs).toContain('createProject');
        });

        it('pick hidden + active preset', function () {
            const options = getOptions(
                {activePresets: ['createProject'], availablePresets: ['createProject']},
                {finishedPresets: []},
            );
            // @ts-ignore
            options.config.presets.createProject.visibility = 'initialHidden';

            const controller = new Controller(options);
            const presetSlugs = controller.userPresets.map(({slug}) => slug);

            expect(presetSlugs).toContain('createProject');
        });

        it('pick hidden + finished preset', function () {
            const options = getOptions(
                {activePresets: [], availablePresets: ['createProject']},
                {finishedPresets: ['createProject']},
            );
            // @ts-ignore
            options.config.presets.createProject.visibility = 'initialHidden';

            const controller = new Controller(options);
            const presetSlugs = controller.userPresets.map(({slug}) => slug);

            expect(presetSlugs).toContain('createProject');
        });

        it('pick hidden + finished + UNavailable preset', async function () {
            const options = getOptions(
                {activePresets: [], availablePresets: [], wizardState: 'visible'},
                {finishedPresets: ['createProject']},
            );
            // @ts-ignore
            options.config.presets.createProject.visibility = 'initialHidden';

            const controller = new Controller(options);
            await waitForNextTick(); // progress loading
            const presetSlugs = controller.userPresets.map(({slug}) => slug);

            expect(presetSlugs).toContain('createProject');
        });
    });

    describe('always hidden preset', function () {
        it('dont count hidden presets', function () {
            const options = getOptions(
                {activePresets: [], availablePresets: []},
                {finishedPresets: []},
            );
            // @ts-ignore
            options.config.presets.createProject.visibility = 'alwaysHidden';

            const controller = new Controller(options);
            const presetSlugs = controller.userPresets.map(({slug}) => slug);

            expect(presetSlugs).not.toContain('createProject');
        });

        it('dont count hidden + available + active preset', function () {
            const options = getOptions(
                {activePresets: ['createProject'], availablePresets: ['createProject']},
                {finishedPresets: []},
            );
            // @ts-ignore
            options.config.presets.createProject.visibility = 'alwaysHidden';

            const controller = new Controller(options);
            const presetSlugs = controller.userPresets.map(({slug}) => slug);

            expect(presetSlugs).not.toContain('createProject');
        });

        it('dont count hidden + available + finished preset', function () {
            const options = getOptions(
                {activePresets: [], availablePresets: ['createProject']},
                {finishedPresets: ['createProject']},
            );
            // @ts-ignore
            options.config.presets.createProject.visibility = 'alwaysHidden';

            const controller = new Controller(options);
            const presetSlugs = controller.userPresets.map(({slug}) => slug);

            expect(presetSlugs).not.toContain('createProject');
        });
    });
});
