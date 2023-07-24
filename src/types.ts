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

export type PresetStep<Steps extends string, HintParams> = {
    slug: Steps;
    name: string;
    description: string;
    placement?: HintPlacement;
    passMode?: 'onAction' | 'onShowHint';
    hintParams?: HintParams;
    closeOnElementUnmount?: boolean;
    passRestriction?: 'afterPrevious';
};

export type Preset<HintParams, Steps extends string> = {
    name: string;
    description: string;
    type?: 'default' | 'hidden';
    steps: PresetStep<Steps, HintParams | undefined>[];
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
    step: PresetStep<Steps, HintParams | undefined>;
    element: HTMLElement;
};

export type InitOptions<HintParams, Presets extends string, Steps extends string> = {
    config: InitConfig<HintParams, Presets, Steps>;
    baseState: Partial<BaseState> | undefined;
    getProgressState: () => Promise<Partial<ProgressState>>;
    onSave: {
        state: (state: BaseState) => Promise<any>;
        progress: (progress: ProgressState) => Promise<any>;
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

// type inference utils
type UnionToIntersection<U> = (U extends any ? (arg: U) => any : never) extends (
    arg: infer I,
) => void
    ? I
    : never;

export type InferStepsFromPreset<T> = T extends {steps: Array<infer U>}
    ? U extends PresetStep<infer Steps, any>
        ? Steps
        : never
    : never;

export type InferHintParamsFromPreset<T> = T extends {steps: Array<infer U>}
    ? U extends PresetStep<any, infer HintParams>
        ? UnionToIntersection<HintParams>
        : never
    : never;

export type InferStepsFromConfig<T extends InitOptions<any, any, any>> =
    T['config']['presets'] extends Record<any, infer U>
        ? U extends Preset<any, infer Steps>
            ? Steps
            : never
        : never;

export type InferPresetsFromConfig<T> = T extends InitOptions<any, infer U, any> ? U : never;

export type InferHintParamsFromConfig<T extends InitOptions<any, any, any>> =
    T['config']['presets'] extends Record<any, infer U>
        ? U extends Preset<infer HintParams, any>
            ? UnionToIntersection<HintParams>
            : never
        : never;
