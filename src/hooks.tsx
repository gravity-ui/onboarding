import {useCallback, useSyncExternalStore} from 'react';
import type {Controller} from './controller';

export function getHooks<HintParams, Presets extends string, Steps extends string>(
    controller: Controller<HintParams, Presets, Steps>,
) {
    const useOnboardingStep = <T extends never>(step: Steps, readyForHint = true) => {
        const onRefChange = useCallback(
            (node: T) => {
                if (!readyForHint) {
                    return;
                }

                if (node) {
                    controller.stepElementReached({stepSlug: step, element: node});
                } else {
                    controller.stepElementDisappeared(step);
                }
            },
            [readyForHint, step],
        );

        const pass = useCallback(async () => {
            await controller.passStep(step);
        }, [step]);

        const closeHint = useCallback(() => {
            controller.closeHintForStep(step);
        }, [step]);

        return {pass, ref: onRefChange, closeHint};
    };

    const useOnboardingPreset = (preset: Presets) => {
        const addPreset = async () => {
            await controller.addPreset(preset);
        };
        const finishPreset = async () => {
            await controller.finishPreset(preset);
        };

        return {
            addPreset,
            finishPreset,
        };
    };

    const useOnboardingHint = () => {
        const popupData = useSyncExternalStore(
            controller.hintStore.subscribe,
            controller.hintStore.getSnapshot,
        );
        return {
            ...popupData,
            onClose: controller.closeHint,
        };
    };

    const useOnboarding = () => {
        const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);

        return {
            state,
            showWizard: controller.showWizard,
            hideWizard: controller.hideWizard,
        };
    };

    const useResetOnboarding = (preset: Presets) => {
        const resetPresetProgress = async () => {
            await controller.resetPresetProgress([preset]);
        };

        return resetPresetProgress;
    };

    return {
        useOnboardingPreset,
        useOnboardingStep,
        useOnboardingHint,
        useOnboarding,
        useResetOnboarding,
    };
}
