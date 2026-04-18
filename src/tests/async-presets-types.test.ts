import {createAsyncPresets, createOnboarding, createPreset, createStep} from '../index';

const {useOnboardingStep} = createOnboarding({
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

    // @ts-expect-error — unknown slug must fail to compile
    useOnboardingStep('unknownStep');
}

describe('async presets — type inference', () => {
    it('step slugs from asyncPresets are accepted by useOnboardingStep', () => {
        expect(typeof _typeChecks).toBe('function');
    });
});
