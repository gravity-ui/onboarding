import {act, renderHook} from '@testing-library/react';
import {getHooks} from '../core/getHooks';
import {Controller} from '../core/controller';

describe('PromoManager Hooks', () => {
    let controller: Controller;
    let hooks: ReturnType<typeof getHooks>;

    beforeEach(() => {
        const options = {
            config: {
                promoGroups: [
                    {
                        slug: 'testGroup',
                        promos: [
                            {
                                slug: 'testPromo',
                                meta: {
                                    title: 'Test Promo',
                                    description: 'Test Description',
                                },
                            },
                        ],
                    },
                ],
            },
            progressState: {},
            getProgressState: jest.fn(() => Promise.resolve({})),
            onSave: {
                progress: jest.fn(),
            },
        };

        controller = new Controller(options);
        hooks = getHooks(controller);
    });

    describe('usePromoManager', () => {
        it('should return controller methods directly', () => {
            const {result} = renderHook(() => hooks.usePromoManager());

            expect(result.current.requestStartPromo).toBe(controller.requestStart);
            expect(result.current.finisPromo).toBe(controller.finishPromo);
            expect(result.current.cancelPromo).toBe(controller.cancelPromo);
            expect(result.current.skipPromo).toBe(controller.skipPromo);
        });
    });

    describe('usePromo', () => {
        it('should call controller requestStart with promo slug', () => {
            const spy = jest.spyOn(controller, 'requestStart');
            const {result} = renderHook(() => hooks.usePromo('testPromo'));

            act(() => {
                result.current.requestStart();
            });

            expect(spy).toHaveBeenCalledWith('testPromo');
        });

        it('should call controller finishPromo with promo slug', () => {
            const spy = jest.spyOn(controller, 'finishPromo');
            const {result} = renderHook(() => hooks.usePromo('testPromo'));

            act(() => {
                result.current.finish();
            });

            expect(spy).toHaveBeenCalledWith('testPromo', undefined);
        });

        it('should call controller finishPromo with timeout', () => {
            const spy = jest.spyOn(controller, 'finishPromo');
            const {result} = renderHook(() => hooks.usePromo('testPromo'));

            act(() => {
                result.current.finish(1000);
            });

            expect(spy).toHaveBeenCalledWith('testPromo', 1000);
        });

        it('should call controller cancelPromo with promo slug', () => {
            const spy = jest.spyOn(controller, 'cancelPromo');
            const {result} = renderHook(() => hooks.usePromo('testPromo'));

            act(() => {
                result.current.cancel();
            });

            expect(spy).toHaveBeenCalledWith('testPromo', undefined);
        });

        it('should call controller skipPromo with promo slug', () => {
            const spy = jest.spyOn(controller, 'skipPromo');
            const {result} = renderHook(() => hooks.usePromo('testPromo'));

            act(() => {
                result.current.skip();
            });

            expect(spy).toHaveBeenCalledWith('testPromo');
        });
    });

    describe('useActivePromo', () => {
        it('should call controller finishPromo for active promo', () => {
            const spy = jest.spyOn(controller, 'finishPromo');
            const {result} = renderHook(() => hooks.useActivePromo());

            act(() => {
                result.current.finish();
            });

            expect(spy).toHaveBeenCalled();
        });

        it('should call controller cancelPromo for active promo', () => {
            const spy = jest.spyOn(controller, 'cancelPromo');
            const {result} = renderHook(() => hooks.useActivePromo());

            act(() => {
                result.current.cancel();
            });

            expect(spy).toHaveBeenCalled();
        });

        it('should call controller skipPromo for active promo', () => {
            const spy = jest.spyOn(controller, 'skipPromo');
            const {result} = renderHook(() => hooks.useActivePromo());

            act(() => {
                result.current.skipPromo();
            });

            expect(spy).toHaveBeenCalled();
        });

        it('should call controller updateProgressInfo for active promo', () => {
            const spy = jest.spyOn(controller, 'updateProgressInfo');
            const {result} = renderHook(() => hooks.useActivePromo());

            act(() => {
                result.current.updateProgressInfo();
            });

            expect(spy).toHaveBeenCalled();
        });
    });
});
