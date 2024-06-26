import {BaseState, CombinedPreset, OnboardingPlugin, PresetStep, ProgressState} from '../types';

export const getOptions = (
    baseState: Partial<BaseState> = {},
    progressState: Partial<ProgressState> = {},
) => {
    return {
        config: {
            presets: {
                createProject: {
                    name: 'Creating project',
                    steps: [
                        {
                            slug: 'openBoard',
                            name: '',
                            description: '',
                        },
                        {
                            slug: 'createSprint',
                            name: '',
                            description: '',
                        },
                        {
                            slug: 'createIssue',
                            name: '',
                            description: '',
                        },
                    ] as Array<PresetStep<string, {}>>,
                },
                createQueue: {
                    name: 'Creating queue',
                    steps: [] as Array<PresetStep<string, {}>>,
                },
            },
        },
        baseState: {
            wizardState: 'visible' as const,
            availablePresets: ['createProject'],
            activePresets: ['createProject'],
            suggestedPresets: ['createProject'],
            enabled: true,
            ...baseState,
        },
        getProgressState: jest.fn(() =>
            Promise.resolve({
                presetPassedSteps: {
                    createProject: ['openBoard'],
                },
                finishedPresets: [],
                ...progressState,
            }),
        ),
        onSave: {
            state: jest.fn(),
            progress: jest.fn(),
        },
        showHint: jest.fn(),
        debugMode: false,
        logger: {
            level: 'error' as const,
            logger: {
                log: () => {},
                error: () => {},
            },
        },
        plugins: [] as OnboardingPlugin[],
    };
};

export const getOptionsWithCombined = (
    baseState: Partial<BaseState> = {},
    progressState: Partial<ProgressState> = {},
) => {
    const internal1 = {
        name: 'Internal1',
        type: 'internal' as const,
        steps: [
            {
                slug: 'someStepInternal11',
                name: '',
                description: '',
            },
            {
                slug: 'someStepInternal12',
                name: '',
                description: '',
            },
        ] as Array<PresetStep<string, {}>>,
    };

    const internal2 = {
        name: 'Internal2',
        type: 'internal' as const,
        steps: [
            {
                slug: 'someStepInternal2',
                name: '',
                description: '',
            },
        ] as Array<PresetStep<string, {}>>,
    };

    const combinedPreset: CombinedPreset<string> = {
        name: 'combined',
        type: 'combined' as const,
        pickPreset: () => 'internal1',
        internalPresets: ['internal1', 'internal2'],
    };

    const otherPreset = {
        name: 'Other',
        steps: [
            {
                slug: 'otherStep',
                name: '',
                description: '',
            },
        ] as Array<PresetStep<string, {}>>,
    };

    return {
        config: {
            presets: {
                internal1,
                internal2,
                combinedPreset,
                otherPreset,
            },
        },
        baseState: {
            wizardState: 'visible' as const,
            availablePresets: ['combinedPreset', 'otherPreset'],
            activePresets: ['internal1'],
            suggestedPresets: ['internal1'],
            enabled: true,
            ...baseState,
        },
        getProgressState: jest.fn(() =>
            Promise.resolve({
                presetPassedSteps: {},
                finishedPresets: [],
                ...progressState,
            }),
        ),
        onSave: {
            state: jest.fn(),
            progress: jest.fn(),
        },
        showHint: jest.fn(),
        debugMode: false,
        logger: {
            level: 'error' as const,
            logger: {
                log: () => {},
                error: () => {},
            },
        },
        plugins: [] as OnboardingPlugin[],
    };
};

export const getOptionsWithHooks = (...args: Parameters<typeof getOptions>) => ({
    ...getOptions(...args),
    hooks: {
        showHint: jest.fn(),
        stepPass: jest.fn(),
        addPreset: jest.fn(),
        runPreset: jest.fn(),
        beforeRunPreset: jest.fn(),
        finishPreset: jest.fn(),
        beforeSuggestPreset: jest.fn(),
        beforeShowHint: jest.fn(async () => true),
    },
});

export const waitForNextTick = () => new Promise((resolve) => setTimeout(resolve, 0));

export const getAnchorElement = () => {
    const element = document.createElement('div');
    document.body.appendChild(element);

    return element;
};
