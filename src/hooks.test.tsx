import {act, renderHook} from '@testing-library/react';
import {getHooks} from './hooks';
import {Controller} from './controller';
import type {HintState} from './hints/hintStore';
import {getOptions} from './tests/utils';

describe('getHooks', () => {
    let controller: Controller<any, any, any>;

    beforeEach(() => {
        jest.clearAllMocks();

        controller = new Controller(getOptions());

        jest.spyOn(controller, 'stepElementReached');
        jest.spyOn(controller, 'stepElementDisappeared');
        jest.spyOn(controller, 'passStep');
        jest.spyOn(controller, 'closeHintByUser');
        jest.spyOn(controller, 'addPreset');
        jest.spyOn(controller, 'finishPreset');
        jest.spyOn(controller, 'runPreset');
        jest.spyOn(controller, 'resetPresetProgress');
        jest.spyOn(controller, 'suggestPresetOnce');
        jest.spyOn(controller, 'setWizardState');
    });

    describe('useOnboardingStep', () => {
        it('ref set with element and readyForHint=true -> calls stepElementReached', () => {
            const hooks = getHooks(controller);
            const {result} = renderHook(() => {
                const hook = hooks.useOnboardingStep('testStep', true);
                return {
                    ...hook,
                    ref: hook.ref as unknown as (node: Element | null) => void,
                };
            });

            const mockElement = document.createElement('div');
            act(() => {
                result.current.ref(mockElement);
            });

            expect(controller.stepElementReached).toHaveBeenCalledWith({
                stepSlug: 'testStep',
                element: mockElement,
            });
        });

        it('ref set to null and readyForHint=true -> calls stepElementDisappeared', () => {
            const hooks = getHooks(controller);
            const {result} = renderHook(() => {
                const hook = hooks.useOnboardingStep('testStep', true);
                return {
                    ...hook,
                    ref: hook.ref as unknown as (node: Element | null) => void,
                };
            });

            act(() => {
                result.current.ref(null);
            });

            expect(controller.stepElementDisappeared).toHaveBeenCalledWith('testStep');
        });

        it('readyForHint=false -> does not call stepElementReached', () => {
            const hooks = getHooks(controller);
            const {result} = renderHook(() => {
                const hook = hooks.useOnboardingStep('testStep', false);
                return {
                    ...hook,
                    ref: hook.ref as unknown as (node: Element | null) => void,
                };
            });

            const mockElement = document.createElement('div');
            act(() => {
                result.current.ref(mockElement);
            });

            expect(controller.stepElementReached).not.toHaveBeenCalled();
        });

        it('pass called -> calls controller passStep', async () => {
            const hooks = getHooks(controller);
            const {result} = renderHook(() => hooks.useOnboardingStep('testStep'));

            await act(async () => {
                await result.current.pass();
            });

            expect(controller.passStep).toHaveBeenCalledWith('testStep');
        });

        it('closeHint called -> calls controller closeHintByUser', () => {
            const hooks = getHooks(controller);
            const {result} = renderHook(() => hooks.useOnboardingStep('testStep'));

            act(() => {
                result.current.closeHint();
            });

            expect(controller.closeHintByUser).toHaveBeenCalledWith('testStep');
        });
    });

    describe('useOnboardingStepBySelector', () => {
        it('element with matching selector found -> calls stepElementReached', () => {
            // Create a parent element with a child matching the selector
            const parentElement = document.createElement('div');
            const childElement = document.createElement('div');
            childElement.classList.add('test-selector');
            parentElement.appendChild(childElement);

            const hooks = getHooks(controller);

            renderHook(() =>
                hooks.useOnboardingStepBySelector({
                    element: parentElement,
                    selector: '.test-selector',
                    step: 'testStep',
                }),
            );

            expect(controller.stepElementReached).toHaveBeenCalledWith({
                stepSlug: 'testStep',
                element: childElement,
            });
        });

        it('element with selector not found -> calls stepElementDisappeared', () => {
            // Create a parent element without a matching child
            const parentElement = document.createElement('div');

            const hooks = getHooks(controller);

            renderHook(() =>
                hooks.useOnboardingStepBySelector({
                    element: parentElement,
                    selector: '.test-selector',
                    step: 'testStep',
                }),
            );

            expect(controller.stepElementDisappeared).toHaveBeenCalledWith('testStep');
        });

        it('parent element not provided -> calls stepElementDisappeared', () => {
            const hooks = getHooks(controller);

            renderHook(() =>
                hooks.useOnboardingStepBySelector({
                    selector: '.test-selector',
                    step: 'testStep',
                }),
            );

            expect(controller.stepElementDisappeared).toHaveBeenCalledWith('testStep');
        });

        it('readyForHint=false -> does not call stepElementReached', () => {
            const parentElement = document.createElement('div');
            const childElement = document.createElement('div');
            childElement.classList.add('test-selector');
            parentElement.appendChild(childElement);

            const hooks = getHooks(controller);

            renderHook(() =>
                hooks.useOnboardingStepBySelector({
                    element: parentElement,
                    selector: '.test-selector',
                    step: 'testStep',
                    readyForHint: false,
                }),
            );

            expect(controller.stepElementReached).not.toHaveBeenCalled();
        });

        it('pass called -> calls controller passStep', async () => {
            const hooks = getHooks(controller);
            const {result} = renderHook(() =>
                hooks.useOnboardingStepBySelector({
                    selector: '.test-selector',
                    step: 'testStep',
                }),
            );

            await act(async () => {
                await result.current.pass();
            });

            expect(controller.passStep).toHaveBeenCalledWith('testStep');
        });

        it('closeHint called -> calls controller closeHintByUser', () => {
            const hooks = getHooks(controller);
            const {result} = renderHook(() =>
                hooks.useOnboardingStepBySelector({
                    selector: '.test-selector',
                    step: 'testStep',
                }),
            );

            act(() => {
                result.current.closeHint();
            });

            expect(controller.closeHintByUser).toHaveBeenCalledWith('testStep');
        });

        it('component unmounted -> calls stepElementDisappeared', () => {
            const hooks = getHooks(controller);

            const {unmount} = renderHook(() =>
                hooks.useOnboardingStepBySelector({
                    selector: '.test-selector',
                    step: 'testStep',
                }),
            );

            jest.clearAllMocks();

            unmount();

            expect(controller.stepElementDisappeared).toHaveBeenCalledWith('testStep');
        });
    });

    describe('useOnboardingPresets', () => {
        it('hook returned -> provides direct access to controller methods', () => {
            const hooks = getHooks(controller);
            const {result} = renderHook(() => hooks.useOnboardingPresets());

            expect(result.current.addPreset).toBe(controller.addPreset);
            expect(result.current.finishPreset).toBe(controller.finishPreset);
            expect(result.current.runPreset).toBe(controller.runPreset);
            expect(result.current.resetPresetProgress).toBe(controller.resetPresetProgress);
            expect(result.current.suggestPresetOnce).toBe(controller.suggestPresetOnce);
        });
    });

    describe('useOnboardingHint', () => {
        it('hint data available -> returns hint data and onClose function', () => {
            // Setup hint data manually through the controller
            const mockHintData: HintState<any, any, any> = {
                open: true,
                hint: {
                    preset: 'testPreset',
                    step: {
                        slug: 'testStep',
                        name: '',
                        description: '',
                    },
                },
                anchorRef: {current: document.createElement('div')},
            };

            // Mock the hintStore.getSnapshot to return our test data
            controller.hintStore.getSnapshot = jest.fn().mockReturnValue(mockHintData);

            const hooks = getHooks(controller);
            const {result} = renderHook(() => hooks.useOnboardingHint());

            expect(result.current).toEqual({
                ...mockHintData,
                onClose: controller.closeHintByUser,
            });
        });

        it('call close hint -> call controller method', () => {
            const hooks = getHooks(controller);
            const {result} = renderHook(() => hooks.useOnboardingHint());

            expect(result.current.onClose).toBe(controller.closeHintByUser);
        });
    });

    describe('useWizard', () => {
        it('setWizardState called -> updates wizard state through controller', async () => {
            const hooks = getHooks(controller);
            const {result} = renderHook(() => hooks.useWizard());

            await act(async () => {
                await result.current.setWizardState('hidden');
            });

            expect(controller.setWizardState).toHaveBeenCalledWith('hidden');
        });
    });
});
