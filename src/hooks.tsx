import {RefObject, useCallback, useEffect, useMemo, useSyncExternalStore} from 'react';
import type {Controller} from './controller';

type StepBySelectorOptions<Steps> = {
    element?: Element | null | undefined;
    ref?: RefObject<Element | null | undefined>;
    selector: string;
    step: Steps;
    readyForHint?: boolean;
};

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
            controller.closeHintByUser(step);
        }, [step]);

        return {pass, ref: onRefChange, closeHint};
    };

    const useOnboardingStepBySelector = ({
        ref,
        element,
        selector,
        step,
        readyForHint = true,
    }: StepBySelectorOptions<Steps>) => {
        useEffect(() => {
            const parentElement = ref?.current ?? element;

            if (readyForHint) {
                if (parentElement) {
                    const targetElement = parentElement.querySelector(selector);

                    if (targetElement) {
                        controller.stepElementReached({
                            stepSlug: step,
                            element: targetElement,
                        });
                    } else {
                        controller.stepElementDisappeared(step);
                    }
                } else {
                    controller.stepElementDisappeared(step);
                }
            }

            return () => {
                controller.stepElementDisappeared(step);
            };
        }, [ref?.current, element, selector]);

        const pass = useCallback(async () => {
            await controller.passStep(step);
        }, [step]);

        const closeHint = useCallback(() => {
            controller.closeHintByUser(step);
        }, [step]);

        return {
            pass,
            closeHint,
        };
    };

    const useOnboardingPresets = () => {
        return {
            addPreset: controller.addPreset,
            finishPreset: controller.finishPreset,
            runPreset: controller.runPreset,
            resetPresetProgress: controller.resetPresetProgress,
            suggestPresetOnce: controller.suggestPresetOnce,
        };
    };

    const useOnboardingHint = () => {
        const popupData = useSyncExternalStore(
            controller.hintStore.subscribe,
            controller.hintStore.getSnapshot,
        );
        return {
            ...popupData,
            onClose: controller.closeHintByUser,
        };
    };

    const useWizard = () => {
        const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);

        const userPresets = useMemo(() => controller.userPresets, [state]);

        return {
            state,
            userPresets,
            setWizardState: controller.setWizardState,
        };
    };

    return {
        useOnboardingPresets,
        useOnboardingStep,
        useOnboardingHint,
        useWizard,
        useOnboardingStepBySelector,
    };
}
