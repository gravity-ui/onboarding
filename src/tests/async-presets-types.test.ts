import {createAsyncPresets, createOnboarding, createPreset, createStep} from '../index';

const {controller, useOnboardingStep, useOnboardingStepBySelector} = createOnboarding({
    config: {
        presets: {
            syncPreset: createPreset({
                name: 'Sync',
                steps: [createStep({slug: 'syncStep', name: '', description: ''})],
            }),
        },
        asyncPresets: async () =>
            createAsyncPresets({
                asyncPreset: createPreset({
                    name: 'Async',
                    steps: [createStep({slug: 'asyncStep', name: '', description: ''})],
                }),
            }),
    },
    baseState: undefined,
    getProgressState: () => Promise.resolve({}),
    onSave: {
        state: () => Promise.resolve(),
        progress: () => Promise.resolve(),
    },
});

// Never called — body exists only for compile-time @ts-expect-error checks.
function _typeChecks() {
    useOnboardingStep('syncStep');
    useOnboardingStep('asyncStep');
    useOnboardingStepBySelector({selector: '.target', step: 'syncStep'});
    useOnboardingStepBySelector({selector: '.target', step: 'asyncStep'});
    controller.skipStep('syncStep');
    controller.skipStep('asyncStep');
    controller.passOrSkipStep('syncStep');
    controller.passOrSkipStep('asyncStep');

    // @ts-expect-error — unknown slug must fail to compile
    useOnboardingStep('unknownStep');
    // @ts-expect-error — unknown selector step must fail to compile
    useOnboardingStepBySelector({selector: '.target', step: 'unknownStep'});
    // @ts-expect-error — unknown skip slug must fail to compile
    controller.skipStep('unknownStep');
    // @ts-expect-error — unknown pass-or-skip slug must fail to compile
    controller.passOrSkipStep('unknownStep');
}

describe('async presets — type inference', () => {
    it('step slugs from asyncPresets are accepted by useOnboardingStep', () => {
        expect(typeof _typeChecks).toBe('function');
    });
});
