import {act, renderHook} from '@testing-library/react';
import {getHooks} from '../hooks';
import {Controller} from '../controller';
import {getOptions} from './utils';

describe('React Hooks', () => {
    let controller: Controller<any, any, any>;
    let hooks: ReturnType<typeof getHooks>;

    beforeEach(() => {
        const options = getOptions();
        controller = new Controller(options);
        hooks = getHooks(controller);
    });

    describe('useOnboardingStep', () => {
        it('should call passStep when pass is called', async () => {
            const spy = jest.spyOn(controller, 'passStep').mockResolvedValue();
            const {result} = renderHook(() => hooks.useOnboardingStep('openBoard'));

            await act(async () => {
                await result.current.pass();
            });

            expect(spy).toHaveBeenCalledWith('openBoard');
        });

        it('should call closeHintByUser when closeHint is called', () => {
            const spy = jest.spyOn(controller, 'closeHintByUser');
            const {result} = renderHook(() => hooks.useOnboardingStep('openBoard'));

            act(() => {
                result.current.closeHint();
            });

            expect(spy).toHaveBeenCalledWith('openBoard');
        });
    });

    describe('useOnboardingStepBySelector', () => {
        it('should call stepElementReached when element with selector is found', () => {
            const spy = jest.spyOn(controller, 'stepElementReached');
            const container = document.createElement('div');
            const targetElement = document.createElement('button');
            targetElement.className = 'test-button';
            container.appendChild(targetElement);

            renderHook(() =>
                hooks.useOnboardingStepBySelector({
                    element: container,
                    selector: '.test-button',
                    step: 'openBoard',
                }),
            );

            expect(spy).toHaveBeenCalledWith({stepSlug: 'openBoard', element: targetElement});
        });

        it('should call stepElementDisappeared when element with selector is not found', () => {
            const spy = jest.spyOn(controller, 'stepElementDisappeared');
            const container = document.createElement('div');

            renderHook(() =>
                hooks.useOnboardingStepBySelector({
                    element: container,
                    selector: '.non-existent',
                    step: 'openBoard',
                }),
            );

            expect(spy).toHaveBeenCalledWith('openBoard');
        });

        it('should work with ref instead of element', () => {
            const spy = jest.spyOn(controller, 'stepElementReached');
            const container = document.createElement('div');
            const targetElement = document.createElement('button');
            targetElement.className = 'test-button';
            container.appendChild(targetElement);

            const ref = {current: container};

            renderHook(() =>
                hooks.useOnboardingStepBySelector({
                    ref,
                    selector: '.test-button',
                    step: 'openBoard',
                }),
            );

            expect(spy).toHaveBeenCalledWith({stepSlug: 'openBoard', element: targetElement});
        });

        it('should call passStep when pass is called', async () => {
            const spy = jest.spyOn(controller, 'passStep').mockResolvedValue();
            const {result} = renderHook(() =>
                hooks.useOnboardingStepBySelector({
                    selector: '.test',
                    step: 'openBoard',
                }),
            );

            await act(async () => {
                await result.current.pass();
            });

            expect(spy).toHaveBeenCalledWith('openBoard');
        });

        it('should call closeHintByUser when closeHint is called', () => {
            const spy = jest.spyOn(controller, 'closeHintByUser');
            const {result} = renderHook(() =>
                hooks.useOnboardingStepBySelector({
                    selector: '.test',
                    step: 'openBoard',
                }),
            );

            act(() => {
                result.current.closeHint();
            });

            expect(spy).toHaveBeenCalledWith('openBoard');
        });
    });

    describe('useOnboardingPresets', () => {
        it('should return controller methods directly', () => {
            const {result} = renderHook(() => hooks.useOnboardingPresets());

            expect(result.current.addPreset).toBe(controller.addPreset);
            expect(result.current.finishPreset).toBe(controller.finishPreset);
            expect(result.current.runPreset).toBe(controller.runPreset);
            expect(result.current.resetPresetProgress).toBe(controller.resetPresetProgress);
            expect(result.current.suggestPresetOnce).toBe(controller.suggestPresetOnce);
        });
    });

    describe('useOnboardingHint', () => {
        it('should return closeHintByUser method directly', () => {
            const {result} = renderHook(() => hooks.useOnboardingHint());

            expect(result.current.onClose).toBe(controller.closeHintByUser);
        });
    });

    describe('useWizard', () => {
        it('should call controller setWizardState', () => {
            const {result} = renderHook(() => hooks.useWizard());

            expect(result.current.setWizardState).toBe(controller.setWizardState);
        });
    });
});
