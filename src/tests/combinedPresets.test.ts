import {Controller} from '../controller';
import {getAnchorElement, getOptionsWithCombined, waitForNextTick} from './utils';

describe('combined presets', function () {
    describe('run preset', function () {
        let options = getOptionsWithCombined({availablePresets: ['combinedPreset']});

        beforeEach(() => {
            options = getOptionsWithCombined({
                availablePresets: ['combinedPreset'],
                activePresets: [],
            });
        });

        it('run preset -> internal preset become active', async function () {
            const controller = new Controller(options);
            await controller.runPreset('combinedPreset');

            const newState = options.onSave.state.mock.calls[0][0];

            expect(newState.activePresets).toContain('internal1');
        });

        it('run same preset -> not duplicate', async function () {
            const controller = new Controller(options);
            await controller.runPreset('combinedPreset');
            await controller.runPreset('combinedPreset');

            const newState =
                options.onSave.state.mock.calls[options.onSave.state.mock.calls.length - 1][0];

            expect(newState.activePresets).toEqual(['internal1']);
        });

        it('start preset -> calls onBeforeStart on combined and internal preset', async function () {
            const mock1 = jest.fn();
            const mock2 = jest.fn();
            // @ts-ignore
            options.config.presets.combinedPreset.hooks = {onBeforeStart: mock1};
            // @ts-ignore
            options.config.presets.internal1.hooks = {onBeforeStart: mock2};

            const controller = new Controller(options);
            await controller.runPreset('combinedPreset');

            expect(mock1).toHaveBeenCalled();
            expect(mock2).toHaveBeenCalled();
        });

        it('start preset -> calls onStart on combined and internal preset', async function () {
            const mock1 = jest.fn();
            const mock2 = jest.fn();
            // @ts-ignore
            options.config.presets.combinedPreset.hooks = {onStart: mock1};
            // @ts-ignore
            options.config.presets.internal1.hooks = {onStart: mock2};

            const controller = new Controller(options);
            await controller.runPreset('combinedPreset');

            expect(mock1).toHaveBeenCalled();
            expect(mock2).toHaveBeenCalled();
        });

        it('run preset -> show hint for existing element', async function () {
            options.baseState.activePresets = [];

            const controller = new Controller(options);
            await controller.stepElementReached({
                stepSlug: 'someStepInternal11',
                element: getAnchorElement(),
            });

            await controller.runPreset('combinedPreset');
            await waitForNextTick();

            await expect(options.showHint).toHaveBeenCalled();
        });

        it('run preset -> close current hint', async function () {
            const controller = new Controller(getOptionsWithCombined());
            await controller.stepElementReached({
                stepSlug: 'otherStep',
                element: getAnchorElement(),
            });

            await controller.runPreset('combinedPreset');

            await expect(controller.hintStore.state.open).toBe(false);
        });
    });

    describe('finish preset', function () {
        it('finish preset -> add to finished', async function () {
            const options = getOptionsWithCombined();

            const controller = new Controller(options);
            await controller.finishPreset('combinedPreset');

            const newBaseState = options.onSave.state.mock.calls[0][0];
            const newProgressState = options.onSave.progress.mock.calls[0][0];

            expect(newBaseState.activePresets).toEqual([]);
            expect(newProgressState.finishedPresets).toEqual(['internal1']);
        });

        it('finish same preset -> not duplicate', async function () {
            const options = getOptionsWithCombined();

            const controller = new Controller(options);
            await controller.finishPreset('combinedPreset');
            await controller.finishPreset('combinedPreset');

            const newProgressState = options.onSave.progress.mock.calls[1][0];

            expect(newProgressState.finishedPresets).toEqual(['internal1']);
        });

        it('finish preset -> on combined and internal preset', async function () {
            const options = getOptionsWithCombined();

            const mock1 = jest.fn();
            const mock2 = jest.fn();
            // @ts-ignore
            options.config.presets.combinedPreset.hooks = {onEnd: mock1};
            // @ts-ignore
            options.config.presets.internal1.hooks = {onEnd: mock2};

            const controller = new Controller(options);
            await controller.finishPreset('combinedPreset');

            expect(mock1).toHaveBeenCalled();
            expect(mock2).toHaveBeenCalled();
        });

        it('finish preset -> stay in suggested', async function () {
            const options = getOptionsWithCombined();

            const controller = new Controller(options);
            await controller.finishPreset('combinedPreset');

            const newBaseState = options.onSave.state.mock.calls[0][0];

            expect(newBaseState.suggestedPresets).toEqual(['internal1']);
        });
    });

    describe('reset progress', function () {
        it('remove progress, remove from finished', async function () {
            const options = getOptionsWithCombined({}, {finishedPresets: ['internal1']});

            const controller = new Controller(options);
            await controller.resetPresetProgress(['combinedPreset']);

            const newProgressState = options.onSave.progress.mock.calls[0][0];

            // remove from finished
            expect(newProgressState.finishedPresets).toEqual([]);

            // remove passed steps
            expect(newProgressState.presetPassedSteps.createProject).toBeUndefined();

            const newBaseState = options.onSave.state.mock.calls[0][0];
            // remove from suggested presets
            expect(newBaseState.activePresets).toEqual([]);
        });
    });
});

describe('combined user presets', function () {
    it('should show combined preset', function () {
        const controller = new Controller(getOptionsWithCombined());
        expect(controller.userPresets).toHaveLength(2);
    });

    it('should hide internal preset', function () {
        const controller = new Controller(getOptionsWithCombined());
        expect(controller.userPresets).not.toContain('internal1');
    });

    it('internal preset active -> combined status = inProgress', function () {
        const controller = new Controller(getOptionsWithCombined());
        const combinedPreset = controller.userPresets.find(
            (preset) => preset.slug === 'combinedPreset',
        );

        expect(combinedPreset?.status).toBe('inProgress');
    });

    it('internal preset finished -> combined status = finished', async function () {
        const controller = new Controller(
            getOptionsWithCombined(
                {activePresets: [], wizardState: 'visible'},
                {finishedPresets: ['internal1']},
            ),
        );
        await controller.ensureRunning();
        await waitForNextTick(); // progress loading

        const combinedPreset = controller.userPresets.find(
            (preset) => preset.slug === 'combinedPreset',
        );
        expect(combinedPreset?.status).toBe('finished');
    });

    it('internal preset untouched -> combined status = unPassed', function () {
        const controller = new Controller(getOptionsWithCombined({activePresets: []}));

        const combinedPreset = controller.userPresets.find(
            (preset) => preset.slug === 'combinedPreset',
        );
        expect(combinedPreset?.status).toBe('unPassed');
    });
});
