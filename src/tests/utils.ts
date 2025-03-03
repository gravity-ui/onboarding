import {
    BaseState,
    CombinedPreset,
    InitOptions,
    OnboardingPlugin,
    PresetStep,
    ProgressState,
} from '../types';
import {PromoPresetsPlugin} from '../plugins/promo-presets';

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
        ignoreUnknownPresets: false as boolean,
        logger: {
            level: 'error' as const,
            logger: {
                debug: () => {},
                error: jest.fn(),
            },
        },
        plugins: [] as OnboardingPlugin[],
        customDefaultState: {} as Partial<BaseState>,
        progressState: undefined,
    } satisfies InitOptions<any, any, any>;
};

export const getSameStepsOptions = (
    baseState: Partial<BaseState> = {},
    progressState: Partial<ProgressState> = {},
) => {
    return {
        config: {
            presets: {
                preset1: {
                    name: 'preset1',
                    steps: [
                        {
                            slug: 'step1',
                            name: 'preset1step1',
                            description: '',
                        },
                        {
                            slug: 'step2',
                            name: 'preset1step2',
                            description: '',
                        },
                        {
                            slug: 'step3',
                            name: 'preset1step3',
                            description: '',
                        },
                    ] as Array<PresetStep<string, {}>>,
                },
                preset2: {
                    name: 'preset2',
                    steps: [
                        {
                            slug: 'step1',
                            name: 'preset2step1',
                            description: '',
                        },
                        {
                            slug: 'step2',
                            name: 'preset2step2',
                            description: '',
                        },
                        {
                            slug: 'step3',
                            name: 'preset2step3',
                            description: '',
                        },
                    ] as Array<PresetStep<string, {}>>,
                },
            },
        },
        baseState: {
            wizardState: 'visible' as const,
            availablePresets: [],
            activePresets: [],
            suggestedPresets: [],
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
        ignoreUnknownPresets: false as boolean,
        logger: {
            level: 'error' as const,
            logger: {
                debug: () => {},
                error: jest.fn(),
            },
        },
        plugins: [] as OnboardingPlugin[],
        customDefaultState: {} as Partial<BaseState>,
        progressState: undefined,
    } satisfies InitOptions<any, any, any>;
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
                debug: () => {},
                error: () => {},
            },
        },
        plugins: [] as OnboardingPlugin[],
    };
};

export const getOptionsWithPromo = (baseState: Partial<BaseState> = {}) => {
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
                    ] as Array<PresetStep<string, {}>>,
                },
                coolNewFeature: {
                    name: 'Cool feature',
                    visibility: 'alwaysHidden' as const,
                    steps: [
                        {
                            slug: 'showCoolFeature',
                            name: '',
                            description: '',
                        },
                    ] as Array<PresetStep<string, {}>>,
                },
                coolNewFeature2: {
                    name: 'Cool feature2',
                    visibility: 'alwaysHidden' as const,
                    steps: [
                        {
                            slug: 'showCoolFeature2',
                            name: '',
                            description: '',
                        },
                    ] as Array<PresetStep<string, {}>>,
                },
            },
        },
        baseState: {
            wizardState: 'visible' as const,
            availablePresets: ['createProject', 'coolNewFeature'],
            activePresets: ['createProject', 'coolNewFeature'],
            suggestedPresets: ['createProject', 'coolNewFeature'],
            enabled: true,
            ...baseState,
        },
        getProgressState: async () => ({}),
        onSave: {
            state: jest.fn(),
            progress: jest.fn(),
        },
        logger: {
            level: 'error' as const,
            logger: {
                debug: () => {},
                error: () => {},
            },
        },
        plugins: [new PromoPresetsPlugin()] as OnboardingPlugin[],
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
