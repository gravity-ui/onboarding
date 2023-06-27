import {getHooks} from './hooks';
import {Controller} from './controller';
import type {InitOptions, Preset, PresetStep} from './types';

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

export function createStep<StepSlug extends string, HintParams>(
    step: PresetStep<StepSlug, HintParams>,
) {
    return step;
}

export function createPreset<HintParams, Steps extends string>(preset: Preset<HintParams, Steps>) {
    return preset;
}

export function createOnboarding<HintParams, Presets extends string, Steps extends string>(
    options: InitOptions<HintParams, Presets, Steps>,
) {
    const controller = new Controller<HintParams, Presets, Steps>(options);

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
