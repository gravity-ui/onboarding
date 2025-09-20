import {
    closeHint,
    createCombinedPreset,
    createInternalPreset,
    createOnboarding,
    createPreset,
    createStep,
    finishPreset,
    passStep,
    setWizardState,
} from '../index';
import {getOptions} from './utils';

describe('Main API', () => {
    describe('createOnboarding', () => {
        it('should create controller with provided options', () => {
            const options = getOptions();
            const onboarding = createOnboarding(options);

            expect(onboarding.controller.options).toEqual(options);
        });
    });

    describe('createStep', () => {
        it('should return the step object as is', () => {
            const step = {
                slug: 'test-step',
                name: 'Test Step',
                description: 'Test description',
            };

            const result = createStep(step);

            expect(result).toBe(step);
        });
    });

    describe('createPreset', () => {
        it('should return preset object when passed object', () => {
            const preset = {
                name: 'Test Preset',
                steps: [
                    {
                        slug: 'step1',
                        name: 'Step 1',
                        description: 'Description',
                    },
                ],
            };

            const result = createPreset(preset);

            expect(result).toBe(preset);
        });

        it('should return preset function when passed function', () => {
            const presetFn = () => ({
                name: 'Dynamic Preset',
                steps: [],
            });

            const result = createPreset(presetFn);

            expect(result).toBe(presetFn);
        });
    });

    describe('createCombinedPreset', () => {
        it('should return combined preset object as is', () => {
            const combinedPreset = {
                name: 'Combined Preset',
                presets: ['preset1', 'preset2'],
            };

            const result = createCombinedPreset(combinedPreset);

            expect(result).toBe(combinedPreset);
        });
    });

    describe('createInternalPreset', () => {
        it('should return internal preset object as is', () => {
            const internalPreset = {
                name: 'Internal Preset',
                type: 'internal' as const,
                steps: [],
            };

            const result = createInternalPreset(internalPreset);

            expect(result).toBe(internalPreset);
        });
    });

    describe('Global functions', () => {
        let onboarding: ReturnType<typeof createOnboarding>;

        beforeEach(() => {
            const options = getOptions();
            onboarding = createOnboarding(options);
        });

        describe('closeHint', () => {
            it('should call controller closeHintByUser', () => {
                const spy = jest.spyOn(onboarding.controller, 'closeHintByUser');

                closeHint();

                expect(spy).toHaveBeenCalled();
            });
        });

        describe('passStep', () => {
            it('should call controller passStep with step name', () => {
                const spy = jest.spyOn(onboarding.controller, 'passStep');

                passStep('openBoard');

                expect(spy).toHaveBeenCalledWith('openBoard');
            });
        });

        describe('finishPreset', () => {
            it('should call controller finishPreset with preset name', async () => {
                const spy = jest
                    .spyOn(onboarding.controller, 'finishPreset')
                    .mockResolvedValue(undefined);

                await finishPreset('createProject');

                expect(spy).toHaveBeenCalledWith('createProject');
            });
        });

        describe('setWizardState', () => {
            it('should call controller setWizardState with state', async () => {
                const spy = jest.spyOn(onboarding.controller, 'setWizardState');

                await setWizardState('visible');

                expect(spy).toHaveBeenCalledWith('visible');
            });
        });
    });

    describe('Global functions without controller', () => {
        it('should handle closeHint when no controller is set', () => {
            // This tests the case when controllerRef is null
            expect(() => closeHint()).not.toThrow();
        });

        it('should handle passStep when no controller is set', () => {
            expect(() => passStep('test')).not.toThrow();
        });

        it('should handle setWizardState when no controller is set', async () => {
            await expect(setWizardState('visible')).resolves.toBeUndefined();
        });
    });
});
