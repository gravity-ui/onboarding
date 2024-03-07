import {getHooks} from './hooks';
import {Controller} from './controller';
import type {
    InitOptions,
    PresetStep,
    InferStepsFromPreset,
    InferHintParamsFromPreset,
    InferHintParamsFromOptions,
    InferStepsFromOptions,
    InferPresetsFromOptions,
} from './types';
import {BaseState, CombinedPreset, CommonPreset, InternalPreset} from './types';

let controllerRef: Controller<object, string, string>;

export function closeHint() {
    if (controllerRef !== null) {
        controllerRef.closeHintByUser();
    }
}

export function passStep(step: string) {
    if (controllerRef !== null) {
        controllerRef.passStep(step);
    }
}

export async function finishPreset(preset: string) {
    if (controllerRef !== null) {
        await controllerRef.finishPreset(preset);
    }
}

export async function setWizardState(state: BaseState['wizardState']) {
    if (controllerRef !== null) {
        await controllerRef.setWizardState(state);
    }
}

export function createStep<
    StepSlug extends string,
    HintParams extends Partial<HintParams> = undefined,
>(step: PresetStep<StepSlug, HintParams>) {
    return step;
}

export function createPreset<T>(preset: T) {
    return preset as CommonPreset<InferHintParamsFromPreset<T>, InferStepsFromPreset<T>>;
}

export function createCombinedPreset<T>(preset: T) {
    return preset as CombinedPreset<string>;
}

export function createInternalPreset<T>(preset: T) {
    return preset as unknown as InternalPreset<
        InferHintParamsFromPreset<T>,
        InferStepsFromPreset<T>
    >;
}

export function createOnboarding<T extends InitOptions<any, any, any>>(options: T) {
    const controller = new Controller<
        InferHintParamsFromOptions<T>,
        InferPresetsFromOptions<T>,
        InferStepsFromOptions<T>
    >(options);

    // @ts-ignore
    controllerRef = controller;

    const {useWizard, useOnboardingPresets, useOnboardingStep, useOnboardingHint} =
        getHooks(controller);

    const presetsNames = Object.keys(
        controller.options.config.presets,
    ) as unknown as keyof typeof controller.options.config.presets;

    return {
        useOnboardingStep,
        useOnboardingPresets,
        useOnboardingHint,
        useWizard,
        controller,
        presetsNames,
    };
}

export * from './types';
export * from './promo-manager/index';
