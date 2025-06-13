import {getAnchorElement, getOptions, getOptionsWithHooks, waitForNextTick} from './utils';
import {Controller} from '../controller';

it('reachElement -> show hint', async function () {
    const options = getOptions();

    const controller = new Controller(options);
    await controller.stepElementReached({
        stepSlug: 'createSprint',
        element: getAnchorElement(),
    });

    expect(options.showHint).toHaveBeenCalled();
});

it('onBeforeShowHint returns false -> dont show hint', async function () {
    const options = getOptionsWithHooks();
    options.hooks.beforeShowHint = jest.fn(async () => false);

    const controller = new Controller(options);
    await controller.stepElementReached({
        stepSlug: 'createSprint',
        element: getAnchorElement(),
    });

    expect(options.showHint).not.toHaveBeenCalled();
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

it('step in 2 presets -> select active', async function () {
    const options = getOptions();
    const step = {
        slug: 'someStep',
        name: '',
        description: '',
    };
    const presets = {
        // not active preset first
        createQueue: options.config.presets.createQueue,
        createProject: options.config.presets.createProject,
    };
    options.config.presets.createProject.steps[1] = step;
    options.config.presets.createQueue.steps.push(step);

    options.config.presets = presets;

    const controller = new Controller(options);
    await controller.stepElementReached({
        stepSlug: 'someStep',
        element: getAnchorElement(),
    });

    expect(options.showHint).toHaveBeenCalled();
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
    const options = getOptions({enabled: false});

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
        await controller.closeHintByUser();

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
        await controller.closeHintByUser('createSprint');

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
        await controller.closeHintByUser('randomStep');

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

    it("close hint -> don't show again", async function () {
        const options = getOptions();

        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'createSprint',
            element: getAnchorElement(),
        });
        controller.closeHintByUser();
        await controller.stepElementReached({
            stepSlug: 'createSprint',
            element: getAnchorElement(),
        });

        await expect(options.showHint).toHaveBeenCalledTimes(1);
    });

    it('element rerendered -> show hint again', async function () {
        const options = getOptions();

        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'createSprint',
            element: getAnchorElement(),
        });
        controller.stepElementDisappeared('createSprint');
        await controller.stepElementReached({
            stepSlug: 'createSprint',
            element: getAnchorElement(),
        });

        const snapshot = controller.hintStore.getSnapshot();

        expect(snapshot.open).toBe(true);
        expect(snapshot.hint?.step.slug).toBe('createSprint');
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

    describe('concurrent element appearance and disappearance', () => {
        let mockElement: Element;

        beforeEach(async () => {
            mockElement = document.createElement('div');
            document.body.appendChild(mockElement);
        });

        afterEach(() => {
            if (mockElement.parentNode) {
                mockElement.parentNode.removeChild(mockElement);
            }
        });

        it('should handle rapid element appearance and disappearance', async () => {
            const options = getOptions();
            const controller = new Controller(options);
            await controller.runPreset('createProject');

            // Rapid element appearance and disappearance
            await controller.stepElementReached({stepSlug: 'createSprint', element: mockElement});
            controller.stepElementDisappeared('createSprint');

            // Check that the state was processed correctly
            expect(controller.hintStore.state.open).toBe(false);
        });

        it('should handle element disappearance during hint processing', async () => {
            const options = getOptions();
            const controller = new Controller(options);
            await controller.runPreset('createProject');

            // Start processing element appearance
            const reachPromise = controller.stepElementReached({
                stepSlug: 'createSprint',
                element: mockElement,
            });

            // Immediately remove the element
            mockElement.remove();
            controller.stepElementDisappeared('createSprint');

            await reachPromise;

            // Check that the hint did not appear
            expect(controller.hintStore.state.open).toBe(false);
        });

        it('should handle multiple rapid element reaches for same step', async () => {
            const options = getOptions();
            const controller = new Controller(options);
            await controller.runPreset('createProject');

            const element1 = document.createElement('div');
            const element2 = document.createElement('div');
            document.body.appendChild(element1);
            document.body.appendChild(element2);

            try {
                // Rapid sequential calls for one step
                await Promise.all([
                    controller.stepElementReached({stepSlug: 'createSprint', element: element1}),
                    controller.stepElementReached({stepSlug: 'createSprint', element: element2}),
                ]);

                // Only one hint should remain
                expect(controller.hintStore.state.open).toBe(true);
                expect(controller.reachedElements.get('createSprint')).toBe(element2); // last element
            } finally {
                element1.remove();
                element2.remove();
            }
        });
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

        expect(newState.presetPassedSteps.createProject).toContain('issueButtons');
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
        await controller.closeHintByUser();
        await waitForNextTick();

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
