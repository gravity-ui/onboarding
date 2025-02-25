import type {ReactNode} from 'react';
import type {LoggerOptions} from './logger';
import {Controller} from './controller';
import {HintState} from './hints/hintStore';

type VoidFn = () => void;

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

export type PresetVisibility = 'visible' | 'initialHidden' | 'alwaysHidden';

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
    visibility?: PresetVisibility;
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
    visibility?: PresetVisibility;
    hooks?: PresetHooks;
    internalPresets: InternalPresets[];
    pickPreset: () => InternalPresets | Promise<InternalPresets>;
};

export type UserPreset<Presets extends string> = {
    slug: Presets;
    name: string;
    description: string;
    status: PresetStatus;
};

export type PresetFunctions = {
    goNextStep: VoidFn;
    goPrevStep: VoidFn;
};
export type PresetField<HintParams, Steps extends string> =
    | Preset<HintParams, Steps>
    | ((presetFunctions: PresetFunctions) => Preset<HintParams, Steps>);

export type InitConfig<HintParams, Presets extends string, Steps extends string> = {
    presets: Record<Presets, PresetField<HintParams, Steps>>;
};

export type ResolvedConfig<HintParams, Presets extends string, Steps extends string> = {
    presets: Record<Presets, Preset<HintParams, Steps>>;
};

export type BaseState = {
    availablePresets: string[];
    activePresets: string[];
    suggestedPresets: string[];
    wizardState: 'hidden' | 'collapsed' | 'visible' | 'invisible';
    enabled: boolean;
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
    progressState?: Partial<ProgressState>;
    getProgressState: () => Promise<Partial<ProgressState>>;
    onSave: {
        state: (state: BaseState) => Promise<any>;
        progress: (progress: ProgressState) => Promise<any>;
    };
    showHint?: (params: ShowHintParams<HintParams, Presets, Steps>) => void;
    logger?: LoggerOptions;
    ignoreUnknownPresets?: boolean;
    debugMode?: boolean;
    customDefaultState?: Partial<BaseState>;
    plugins?: OnboardingPlugin[];
    hooks?: {
        [K in keyof EventsMap<HintParams, Presets, Steps>]?: (
            data: EventsMap<HintParams, Presets, Steps>[K],
            instance: Controller<HintParams, Presets, Steps>,
        ) => HookCallbackReturnType;
    };
};

export type ResolvedOptions<HintParams, Presets extends string, Steps extends string> = Exclude<
    InitOptions<HintParams, Presets, Steps>,
    'config'
> & {config: ResolvedConfig<HintParams, Presets, Steps>};

export type OnboardingPlugin = {
    name: string;
    apply: (pluginInterface: {onboarding: Controller<any, any, any>}) => void;
};

type HookCallbackReturnType = void | boolean | Promise<void | boolean>;
export type EventListener = (...args: any[]) => HookCallbackReturnType;

export type EventsMap<
    HintParams = any,
    Presets extends string = string,
    Steps extends string = string,
> = {
    showHint: {preset: Presets; step: Steps};
    stepPass: {preset: Presets; step: Steps};
    addPreset: {preset: Presets};
    beforeRunPreset: {preset: Presets};
    runPreset: {preset: Presets};
    finishPreset: {preset: Presets};
    beforeSuggestPreset: {preset: string};
    stepElementReached: {stepData: ReachElementParams<Presets, Steps>};
    beforeShowHint: {stepData: ReachElementParams<Presets, Steps>};
    stateChange: {state: Controller<any, any, any>['state']};
    hintDataChanged: {state: HintState<HintParams, Presets, Steps>};
    closeHint: {hint: Pick<ShowHintParams<HintParams, Presets, Steps>, 'preset' | 'step'>};
    closeHintByUser: {hint: Pick<ShowHintParams<HintParams, Presets, Steps>, 'preset' | 'step'>};
    init: {};
    wizardStateChanged: {wizardState: BaseState['wizardState']};
};

export type EventTypes = keyof EventsMap<any, any, any>;

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
