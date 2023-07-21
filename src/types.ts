import type {LoggerOptions} from './logger';

type HintPlacement =
    | 'top'
    | 'bottom'
    | 'right'
    | 'left'
    | 'auto'
    | 'auto-start'
    | 'auto-end'
    | 'top-start'
    | 'top-end'
    | 'bottom-start'
    | 'bottom-end'
    | 'right-start'
    | 'right-end'
    | 'left-start'
    | 'left-end';

export type PresetStep<Steps extends string, HintParams = {}> = {
    slug: Steps;
    name: string;
    description: string;
    placement?: HintPlacement;
    passMode?: 'onAction' | 'onShowHint';
    hintParams?: Partial<HintParams>;
    closeOnElementUnmount?: boolean;
    passRestriction?: 'afterPrevious';
};

export type Preset<HintParams, Steps extends string> = {
    name: string;
    description: string;
    type?: 'default' | 'hidden';
    steps: PresetStep<Steps, HintParams>[];
    hidden?: boolean;
    hooks?: {
        onStart?: () => void;
        onEnd?: () => void;
    };
};

export type InitConfig<HintParams, Presets extends string, Steps extends string> = {
    presets: Record<Presets, Preset<HintParams, Steps>>;
};

export type BaseState = {
    wizardActive: boolean;
    activePresets: string[];
    suggestedPresets: string[];
};

export type ProgressState = {
    presetPassedSteps: Record<string, string[]>;
    finishedPresets: string[];
};

export type ReachElementParams<Presets, Steps> = {
    preset: Presets;
    stepSlug: Steps;
    element: HTMLElement;
};

export type ShowHintParams<HintParams, Presets extends string, Steps extends string> = {
    preset: Presets;
    step: PresetStep<Steps, HintParams>;
    element: HTMLElement;
};

export type InitOptions<HintParams, Presets extends string, Steps extends string> = {
    config: InitConfig<HintParams, Presets, Steps>;
    baseState: Partial<BaseState> | undefined;
    getProgressState: () => Promise<Partial<ProgressState>>;
    onSave: {
        state: (state: BaseState) => Promise<unknown>;
        progress: (progress: ProgressState) => Promise<unknown>;
    };
    showHint?: (params: ShowHintParams<HintParams, Presets, Steps>) => void;
    logger?: LoggerOptions;
    debugMode?: boolean;
    hooks?: {
        onShowHint?: (data: {preset: Presets; step: Steps}) => void;
        onStepPass?: (data: {preset: Presets; step: Steps}) => void;
        onAddPreset?: (data: {preset: Presets}) => void;
        onFinishPreset?: (data: {preset: Presets}) => void;
    };
};
