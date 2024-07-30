import {Controller} from '../core/controller';
import {testOptions} from '../tests/options';
import {UrlEventsPlugin} from './url-event-plugin';
import {waitForNextTick} from '../tests/utils';

const EVENT_NAME = 'specificEventName';

it('trigger event on init', async () => {
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
                            trigger: {on: EVENT_NAME},
                        },
                    ],
                },
            ],
        },
        plugins: [new UrlEventsPlugin({eventName: EVENT_NAME})],
    });
    await controller.ensureInit();

    expect(controller.state.base.activePromo).toBe('promo1');
});

it('change url -> trigger', async () => {
    const SPECIFIC_URL = 'http://localhost/specific-purl/';
    const controller = new Controller({
        ...testOptions,
        config: {
            promoGroups: [
                {
                    slug: '1',
                    promos: [
                        {
                            slug: 'promo1',
                            conditions: [() => location.href === SPECIFIC_URL],
                            trigger: {on: EVENT_NAME},
                        },
                    ],
                },
            ],
        },
        plugins: [new UrlEventsPlugin({eventName: EVENT_NAME})],
    });

    await controller.ensureInit();
    expect(controller.state.base.activePromo).toBe(null);

    window.history.pushState({}, '', new URL(SPECIFIC_URL));

    await waitForNextTick();
    expect(controller.state.base.activePromo).toBe('promo1');
});
