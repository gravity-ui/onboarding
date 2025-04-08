import {
    CombinedPreset,
    InferHintParamsFromPreset,
    InferStepsFromPreset,
    PresetField,
    createCombinedPreset,
    createOnboarding,
    createPreset,
    createStep,
} from '../index';
import {Controller} from '../controller';

type Expect<T extends true> = T;
type Equal<X, Y> =
    (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
type Extends<X, Y> = X extends Y ? true : false;
type Not<T extends boolean> = T extends false ? true : false;

const commonPreset = createPreset({
    name: 'one',
    description: '',
    steps: [
        createStep({
            slug: 'step1',
            name: '1',
            description: 'фыв',
            hintParams: {
                a: 1,
            },
        }),
        createStep({
            slug: 'step2',
            name: '2',
            description: 'фыв',
        }),
    ],
});

const combinedPreset = createCombinedPreset({
    name: 'two',
    description: '',
    type: 'combined' as const,
    internalPresets: ['one'],
    pickPreset: () => 'one',
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const {controller} = createOnboarding({
    config: {
        presets: {
            one: commonPreset,
            two: combinedPreset,
        },
    },
    baseState: {},
    getProgressState: async () => ({}),
    onSave: {
        state: async () => {},
        progress: async () => {},
    },
});

/* eslint-disable @typescript-eslint/no-unused-vars */

// infer preset params
export type PresetHelper1 = Expect<
    Equal<InferStepsFromPreset<typeof commonPreset>, 'step1' | 'step2'>
>;
export type PresetHelper2 = Expect<
    Equal<InferHintParamsFromPreset<typeof commonPreset>, {a: number} | undefined>
>;

// preset helper types
export type Preset1 = Expect<Equal<typeof combinedPreset, CombinedPreset<string>>>;
export type Preset2 = Expect<
    Equal<typeof commonPreset, PresetField<{a: number} | undefined, 'step1' | 'step2'>>
>;

// onboarding types
export type Onboarding1 = Expect<
    Extends<typeof controller, Controller<any, 'one' | 'two', 'step1' | 'step2'>>
>;

type OnboardingHintType = typeof controller extends Controller<infer U, any, any> ? U : never;
export type OnboardingHint1 = Expect<Extends<OnboardingHintType, {a?: number}>>;
export type OnboardingHint2 = Expect<Extends<OnboardingHintType, {a: number}>>;
export type OnboardingHint3 = Expect<Not<Extends<OnboardingHintType, {b?: number}>>>;
