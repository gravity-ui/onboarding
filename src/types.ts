import type {ReactNode} from 'react';
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

export type PresetStatus = 'unPassed' | 'inProgress' | 'finished';

export type PresetStep<Steps extends string, HintParams> = {
    slug: Steps;
    name: string;
    description: string;
    placement?: HintPlacement;
    passMode?: 'onAction' | 'onShowHint';
    hintParams?: HintParams;
    closeOnElementUnmount?: boolean;
    passRestriction?: 'afterPrevious';
    hooks?: {
        onStepPass?: () => void;
        onCloseHint?: () => void;
        onCloseHintByUser?: () => void;
    };
};

export type Preset<HintParams, Steps extends string> =
    | CommonPreset<HintParams, Steps>
    | CombinedPreset<string>
    | InternalPreset<HintParams, Steps>;

export type PresetHooks = {
    onBeforeStart?: () => Promise<void> | void;
    onStart?: () => void;
    onEnd?: () => void;
};

export type CommonPreset<HintParams, Steps extends string> = {
    name: string;
    description?: ReactNode;
    type?: 'default';
    visibility?: 'visible' | 'hidden';
    steps: PresetStep<Steps, HintParams | undefined>[];
    hooks?: PresetHooks;
};

export type InternalPreset<HintParams, Steps extends string> = {
    type: 'internal';
    steps: PresetStep<Steps, HintParams | undefined>[];
    hooks?: PresetHooks;
};

export type ContentfulPresets<HintParams, Steps extends string> =
    | CommonPreset<HintParams, Steps>
    | InternalPreset<HintParams, Steps>;

export type CombinedPreset<InternalPresets extends string> = {
    name: string;
    description?: ReactNode;
    type: 'combined';
    visibility?: 'visible' | 'hidden';
    hooks?: PresetHooks;
    internalPresets: InternalPresets[];
    pickPreset: () => InternalPresets | Promise<InternalPresets>;
};

export type InitConfig<HintParams, Presets extends string, Steps extends string> = {
    presets: Record<Presets, Preset<HintParams, Steps>>;
};

export type BaseState = {
    availablePresets: string[];
    activePresets: string[];
    suggestedPresets: string[];
    wizardState: 'hidden' | 'collapsed' | 'visible' | 'invisible';
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
        onRunPreset?: (data: {preset: Presets}) => void;
        onFinishPreset?: (data: {preset: Presets}) => void;
    };
};

// type inference utils
type CommonKeys<T extends object> = keyof T;
type AllKeys<T> = T extends any ? keyof T : never;
type Subtract<A, C> = A extends C ? never : A;
type NonCommonKeys<T extends object> = Subtract<AllKeys<T>, CommonKeys<T>>;
type PickType<T, K extends AllKeys<T>> = T extends {[k in K]?: any} ? T[K] : undefined;

export type Merge<T extends object> = {
    [k in keyof T]: PickTypeOf<T, k>;
} & {
    [k in NonCommonKeys<T>]?: PickTypeOf<T, k>;
};

type PickTypeOf<T, K extends string | number | symbol> = K extends AllKeys<T>
    ? PickType<T, K>
    : never;

export type InferStepsFromPreset<T> = T extends {steps: Array<infer U>}
    ? U extends PresetStep<infer Steps, any>
        ? Steps
        : never
    : never;

export type InferHintParamsFromPreset<T> = T extends {steps: Array<infer U>}
    ? U extends PresetStep<any, infer HintParams>
        ? HintParams
        : never
    : never;

export type InferStepsFromOptions<T extends InitOptions<any, any, any>> =
    T['config']['presets'] extends Record<any, infer U>
        ? U extends ContentfulPresets<any, infer Steps>
            ? Steps
            : never
        : never;

export type InferPresetsFromOptions<T> = T extends InitOptions<any, infer U, any> ? U : never;

export type InferHintParamsFromOptions<T extends InitOptions<any, any, any>> = Merge<
    T['config']['presets'] extends Record<any, infer U>
        ? U extends ContentfulPresets<infer HintParams, any>
            ? HintParams
            : never
        : never
>;
