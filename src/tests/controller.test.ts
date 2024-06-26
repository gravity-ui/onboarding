import {Controller} from '../controller';
import {getAnchorElement, getOptions} from './utils';

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
            enabled: false,
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
