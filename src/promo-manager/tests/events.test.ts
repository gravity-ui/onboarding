import {Controller} from '../core/controller';
import {testOptions} from './options';

it('can run promo with custom event', async () => {
    const controller = new Controller({
        ...testOptions,
        config: {
            promoGroups: [
                {
                    slug: '1',
                    promos: [
                        {
                            slug: 'promo1',
                            conditions: [],
                            trigger: 'someCustomEvent',
                        },
                    ],
                },
            ],
        },
    });

    await controller.sendEvent('someCustomEvent');

    expect(controller.state.base.activePromo).toBe('promo1');
});
