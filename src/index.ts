import {getHooks} from './hooks';
import {Controller} from './controller';
import type {
    InitOptions,
    Preset,
    PresetStep,
    InferStepsFromPreset,
    InferHintParamsFromPreset,
    InferHintParamsFromConfig,
    InferStepsFromConfig,
    InferPresetsFromConfig,
} from './types';

let closeHintRef: () => void | undefined;
let passStepRef: (step: string) => Promise<void>;

export function closeHint() {
    if (closeHintRef !== null) {
        closeHintRef();
    }
}

export function passStep(step: string) {
    if (passStepRef !== null) {
        passStepRef(step);
    }
}

export function createStep<
    StepSlug extends string,
    HintParams extends Partial<HintParams> = undefined,
>(step: PresetStep<StepSlug, HintParams>) {
    return step;
}

export function createPreset<T>(preset: T) {
    return preset as unknown as Preset<InferHintParamsFromPreset<T>, InferStepsFromPreset<T>>;
}

export function createOnboarding<T extends InitOptions<any, any, any>>(options: T) {
    const controller = new Controller<
        InferHintParamsFromConfig<T>,
        InferPresetsFromConfig<T>,
        InferStepsFromConfig<T>
    >(options);

    closeHintRef = controller.closeHint;
    // @ts-ignore
    passStepRef = controller.passStep;

    const {useOnboarding, useOnboardingPreset, useOnboardingStep, useOnboardingHint} =
        getHooks(controller);

    return {
        useOnboardingStep,
        useOnboardingPreset,
        useOnboardingHint,
        useOnboarding,
        controller,
    };
}
