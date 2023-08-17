import {getAnchorElement, getOptions} from './utils';
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
    const options = getOptions({wizardState: 'hidden'});

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
        await controller.closeHint();

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
        await controller.closeHintForStep('createSprint');

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
        await controller.closeHintForStep('randomStep');

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
    it('should show hint only once for session', async function () {
        const options = getOptions();

        const controller = new Controller(options);
        controller.stepElementReached({
            stepSlug: 'createSprint',
            element: getAnchorElement(),
        });
        await controller.stepElementReached({
            stepSlug: 'createSprint',
            element: getAnchorElement(),
        });

        await expect(options.showHint).toHaveBeenCalledTimes(1);
    });

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

        expect(newState.presetPassedSteps.createProject).toEqual([
            'openBoard',
            'createSprint',
            'createIssue',
            'issueButtons',
        ]);
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
        await controller.closeHint();

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
