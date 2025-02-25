import {getAnchorElement, getOptions, getOptionsWithHooks, waitForNextTick} from './utils';
import {Controller} from '../controller';

describe('showHint event', () => {
    it('reachElement -> showHint called', async function () {
        const options = getOptionsWithHooks();
        const controller = new Controller(options);

        await controller.stepElementReached({
            stepSlug: 'createSprint',
            element: getAnchorElement(),
        });

        expect(options.hooks.showHint).toHaveBeenCalledWith(
            {
                preset: 'createProject',
                step: 'createSprint',
            },
            controller,
        );
    });

    it('reachElement on NOT active preset -> NOT calls showHint', async function () {
        const options = getOptionsWithHooks({activePresets: []});
        const controller = new Controller(options);

        await controller.stepElementReached({
            stepSlug: 'createSprint',
            element: getAnchorElement(),
        });

        expect(options.hooks.showHint).not.toHaveBeenCalled();
    });

    it('reachElement on passed step -> NOT calls showHint', async function () {
        const options = getOptionsWithHooks();

        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'createIssue',
            element: getAnchorElement(),
        });

        expect(options.hooks.showHint).not.toHaveBeenCalled();
    });
});

describe('stepPass event', () => {
    it('pass step on active preset -> calls passStep', async function () {
        const options = getOptionsWithHooks();

        const controller = new Controller(options);
        await controller.passStep('createSprint');

        expect(options.hooks.stepPass).toHaveBeenCalledWith(
            {
                preset: 'createProject',
                step: 'createSprint',
            },
            controller,
        );
    });

    it('pass step on NOT active, but available preset -> calls passStep', async function () {
        const options = getOptionsWithHooks({activePresets: []});

        const controller = new Controller(options);
        await controller.passStep('createSprint');

        expect(options.hooks.stepPass).toHaveBeenCalledWith(
            {
                preset: 'createProject',
                step: 'createSprint',
            },
            controller,
        );
    });

    it('pass step on NOT active and NOT available preset -> NOT calls passStep', async function () {
        const options = getOptionsWithHooks({activePresets: [], availablePresets: []});

        const controller = new Controller(options);
        await controller.passStep('createSprint');

        expect(options.hooks.stepPass).not.toHaveBeenCalled();
    });

    it('unknown preset -> NOT calls passStep', async function () {
        const options = getOptionsWithHooks();

        const controller = new Controller(options);
        await controller.passStep('someUnknownStep');

        expect(options.hooks.stepPass).not.toHaveBeenCalled();
    });

    it('step already passed -> NOT calls passStep', async function () {
        const options = getOptionsWithHooks();

        const controller = new Controller(options);
        await controller.passStep('openBoard');

        expect(options.hooks.stepPass).not.toHaveBeenCalled();
    });
});

describe('preset hooks', function () {
    it('add preset -> calls addPreset', async function () {
        expect.assertions(1);

        const options = getOptionsWithHooks();

        const controller = new Controller(options);
        await controller.addPreset('createQueue');

        await waitForNextTick();

        await expect(options.hooks.addPreset).toHaveBeenCalledWith(
            {
                preset: 'createQueue',
            },
            controller,
        );
    });

    it('run preset -> call beforeRunPreset before activating', async function () {
        expect.assertions(2);
        const options = getOptionsWithHooks();
        const controller = new Controller(options);

        controller.events.subscribe('beforeRunPreset', () => {
            expect(controller.state.base.activePresets).not.toContain('createQueue');
        });

        await controller.runPreset('createQueue');

        await expect(options.hooks.beforeRunPreset).toHaveBeenCalledWith(
            {
                preset: 'createQueue',
            },
            controller,
        );
    });

    it('run preset -> call runPreset', async function () {
        expect.assertions(2);
        const options = getOptionsWithHooks();
        const controller = new Controller(options);

        controller.events.subscribe('runPreset', () => {
            expect(controller.state.base.activePresets).toContain('createQueue');
        });

        await controller.runPreset('createQueue');

        expect(options.hooks.runPreset).toHaveBeenCalledWith(
            {
                preset: 'createQueue',
            },
            controller,
        );
    });

    it('finish preset by pass step -> calls finishPreset', async function () {
        const options = getOptionsWithHooks(
            {},
            {presetPassedSteps: {createProject: ['openBoard', 'createSprint']}},
        );

        const controller = new Controller(options);
        await controller.passStep('createIssue');

        expect(options.hooks.finishPreset).toHaveBeenCalledWith(
            {
                preset: 'createProject',
            },
            controller,
        );
    });

    it('force finish preset -> calls finishPreset', async function () {
        const options = getOptionsWithHooks();

        const controller = new Controller(options);
        await controller.finishPreset('createProject');

        expect(options.hooks.finishPreset).toHaveBeenCalledWith(
            {
                preset: 'createProject',
            },
            controller,
        );
    });

    it('suggest preset -> call beforeSuggestPreset before', async function () {
        expect.assertions(1);
        const options = getOptionsWithHooks();
        const controller = new Controller(options);

        await controller.suggestPresetOnce('createQueue');

        expect(options.hooks.beforeSuggestPreset).toHaveBeenCalledWith(
            {
                preset: 'createQueue',
            },
            controller,
        );
    });

    it('suggest preset 2 times -> call beforeSuggestPreset ONCE', async function () {
        const options = getOptionsWithHooks();

        const controller = new Controller(options);

        await controller.suggestPresetOnce('createQueue');
        await controller.suggestPresetOnce('createQueue');

        await waitForNextTick();

        expect(options.hooks.beforeSuggestPreset).toHaveBeenCalledTimes(1);
    });
});
describe('event subscriptions', function () {
    it('beforeShowHint', async function () {
        const controller = new Controller(getOptions());

        const mock = jest.fn();
        controller.events.subscribe('beforeShowHint', mock);

        await controller.stepElementReached({
            stepSlug: 'createSprint',
            element: getAnchorElement(),
        });

        expect(mock).toHaveBeenCalled();
    });

    it('beforeShowHint with cancel -> no hint', async function () {
        const controller = new Controller(getOptions());

        const mock = jest.fn(() => false);
        controller.events.subscribe('beforeShowHint', mock);

        await controller.stepElementReached({
            stepSlug: 'createSprint',
            element: getAnchorElement(),
        });

        expect(controller.hintStore.state.open).toBe(false);
    });

    it('beforeShowHint with cancel -> call all hooks', async function () {
        const controller = new Controller(getOptions());

        const mock1 = jest.fn(() => false);
        const mock2 = jest.fn();

        controller.events.subscribe('beforeShowHint', mock1);
        controller.events.subscribe('beforeShowHint', mock2);

        await controller.stepElementReached({
            stepSlug: 'createSprint',
            element: getAnchorElement(),
        });

        expect(mock1).toHaveBeenCalled();
        expect(mock2).toHaveBeenCalled();
    });

    it('showHint', async function () {
        const controller = new Controller(getOptions());

        const mock = jest.fn();
        controller.events.subscribe('showHint', mock);

        await controller.stepElementReached({
            stepSlug: 'createSprint',
            element: getAnchorElement(),
        });

        expect(mock).toHaveBeenCalledWith(
            {
                preset: 'createProject',
                step: 'createSprint',
            },
            controller,
        );
    });

    describe('closeHint event', () => {
        it('pass step -> trigger event', async function () {
            const controller = new Controller(getOptions());

            const mock = jest.fn();
            controller.events.subscribe('closeHint', mock);

            await controller.stepElementReached({
                stepSlug: 'createSprint',
                element: getAnchorElement(),
            });
            await controller.passStep('createSprint');

            expect(mock).toHaveBeenCalledWith(
                {
                    hint: {
                        preset: 'createProject',
                        step: {
                            slug: 'createSprint',
                            name: '',
                            description: '',
                        },
                    },
                },
                controller,
            );
        });

        it('element disappeared -> trigger event', async function () {
            const controller = new Controller(getOptions());

            const mock = jest.fn();
            controller.events.subscribe('closeHint', mock);

            await controller.stepElementReached({
                stepSlug: 'createSprint',
                element: getAnchorElement(),
            });
            controller.stepElementDisappeared('createSprint');

            expect(mock).toHaveBeenCalledWith(
                {
                    hint: {
                        preset: 'createProject',
                        step: {
                            slug: 'createSprint',
                            name: '',
                            description: '',
                        },
                    },
                },
                controller,
            );
        });

        it('user close hint -> trigger event', async function () {
            const controller = new Controller(getOptions());

            const mock = jest.fn();
            controller.events.subscribe('closeHint', mock);

            await controller.stepElementReached({
                stepSlug: 'createSprint',
                element: getAnchorElement(),
            });
            controller.closeHint('createSprint');

            expect(mock).toHaveBeenCalledWith(
                {
                    hint: {
                        preset: 'createProject',
                        step: {
                            slug: 'createSprint',
                            name: '',
                            description: '',
                        },
                    },
                },
                controller,
            );
        });

        it('no open hint -> NOT trigger event', async function () {
            const controller = new Controller(getOptions());

            const mock = jest.fn();
            controller.events.subscribe('closeHint', mock);

            controller.closeHint();

            expect(mock).not.toHaveBeenCalled();
        });

        it('try close other hint -> NOT trigger event', async function () {
            const controller = new Controller(getOptions());

            const mock = jest.fn();
            controller.events.subscribe('closeHint', mock);

            await controller.stepElementReached({
                stepSlug: 'createSprint',
                element: getAnchorElement(),
            });
            controller.closeHint('openBoard');

            expect(mock).not.toHaveBeenCalled();
        });
    });

    it('passStep', async function () {
        const controller = new Controller(getOptions());

        const mock = jest.fn();
        controller.events.subscribe('stepPass', mock);

        await controller.passStep('createSprint');

        expect(mock).toHaveBeenCalledWith(
            {
                preset: 'createProject',
                step: 'createSprint',
            },
            controller,
        );
    });

    it('addPreset', async function () {
        const controller = new Controller(getOptions());

        const mock = jest.fn();
        controller.events.subscribe('addPreset', mock);

        await controller.addPreset('createQueue');

        await expect(mock).toHaveBeenCalledWith(
            {
                preset: 'createQueue',
            },
            controller,
        );
    });

    it('beforeRunPreset', async function () {
        const controller = new Controller(getOptions());

        const mock = jest.fn();
        controller.events.subscribe('beforeRunPreset', mock);

        await controller.runPreset('createQueue');

        await expect(mock).toHaveBeenCalledWith(
            {
                preset: 'createQueue',
            },
            controller,
        );
    });

    it('runPreset', async function () {
        const controller = new Controller(getOptions());

        const mock = jest.fn();
        controller.events.subscribe('runPreset', mock);

        await controller.runPreset('createQueue');

        await expect(mock).toHaveBeenCalledWith(
            {
                preset: 'createQueue',
            },
            controller,
        );
    });

    it('finishPreset', async function () {
        const controller = new Controller(getOptions());

        const mock = jest.fn();
        controller.events.subscribe('finishPreset', mock);

        await controller.finishPreset('createProject');

        await expect(mock).toHaveBeenCalledWith(
            {
                preset: 'createProject',
            },
            controller,
        );
    });

    it('beforeSuggestPreset', async function () {
        const controller = new Controller(getOptions());

        const mock = jest.fn();
        controller.events.subscribe('beforeSuggestPreset', mock);

        await controller.suggestPresetOnce('createQueue');

        await expect(mock).toHaveBeenCalledWith(
            {
                preset: 'createQueue',
            },
            controller,
        );
    });
});
