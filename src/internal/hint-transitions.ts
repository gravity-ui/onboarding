type HintTransitions = {
    waitForNextHint(preset: string, onUnavailable?: () => void): Promise<void>;
    invalidatePendingHints(preset: string): void;
};

const hintTransitions = new WeakMap<object, HintTransitions>();

export function registerHintTransitions(instance: object, transitions: HintTransitions) {
    hintTransitions.set(instance, transitions);
}

export function getHintTransitions(instance: object) {
    const transitions = hintTransitions.get(instance);
    if (!transitions) {
        throw new Error('Onboarding hint transitions are not initialized');
    }
    return transitions;
}

const hintCloseChecks = new WeakMap<object, () => boolean>();

export function registerHintCloseCheck(hint: object, isStepTransition: () => boolean) {
    // A reentrant close of the same hint must retain the first transition snapshot.
    if (!hintCloseChecks.has(hint)) {
        hintCloseChecks.set(hint, isStepTransition);
    }
}

export function isHintStepTransition(hint: object) {
    return hintCloseChecks.get(hint)?.() ?? false;
}
