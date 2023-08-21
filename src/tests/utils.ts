import {BaseState, PresetStep, ProgressState} from '../types';

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
    };
};

export const getOptionsWithHooks = (...args: Parameters<typeof getOptions>) => ({
    ...getOptions(...args),
    hooks: {
        onShowHint: jest.fn(),
        onStepPass: jest.fn(),
        onAddPreset: jest.fn(),
        onFinishPreset: jest.fn(),
    },
});

export const waitForNextTick = () => new Promise((resolve) => setTimeout(resolve, 0));

export const getAnchorElement = () => {
    const element = document.createElement('div');
    document.body.appendChild(element);

    return element;
};
