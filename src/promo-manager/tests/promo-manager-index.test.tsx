import {createPromoManager} from '../core/index';

describe('PromoManager Core Index', () => {
    describe('createPromoManager', () => {
        it('should create controller with provided options', () => {
            const options = {
                config: {
                    promoGroups: [],
                },
                progressState: {},
                getProgressState: vi.fn(() => Promise.resolve({})),
                onSave: {
                    progress: vi.fn(),
                },
            };

            const promoManager = createPromoManager(options);

            expect(promoManager.controller).toBeDefined();
            expect(promoManager.controller.options.config).toEqual(options.config);
        });
    });
});
