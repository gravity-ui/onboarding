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
    const useStepActions = (step: Steps) =>
        useMemo(
            () => ({
                pass: async () => {
                    await controller.passStep(step);
                },
                skip: () => controller.skipStep(step),
                passOrSkip: () => controller.passOrSkipStep(step),
                closeHint: () => {
                    controller.closeHintByUser(step);
                },
            }),
            [step],
        );

    const useOnboardingStep = (step: Steps, readyForHint = true) => {
        const actions = useStepActions(step);
        const onRefChange = useCallback(
            (node: Element | null) => {
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

        return {...actions, ref: onRefChange};
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
                const targetElement = parentElement?.querySelector(selector);

                if (targetElement) {
                    controller.stepElementReached({
                        stepSlug: step,
                        element: targetElement,
                    });
                } else {
                    controller.stepElementDisappeared(step);
                }
            }

            return () => {
                controller.stepElementDisappeared(step);
            };
        }, [ref?.current, element, selector]);

        return useStepActions(step);
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
