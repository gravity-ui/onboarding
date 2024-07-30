import {Controller} from '../core/controller';
import {testOptions} from './options';
import {waitForNextTick} from './utils';

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
                            trigger: {on: 'someCustomEvent'},
                        },
                    ],
                },
            ],
        },
    });

    await controller.sendEvent('someCustomEvent');

    expect(controller.state.base.activePromo).toBe('promo1');
});

it('can use timeout in event', async () => {
    const TIMEOUT = 1000;

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
                            trigger: {on: 'someCustomEvent', timeout: TIMEOUT},
                        },
                    ],
                },
            ],
        },
    });

    jest.useFakeTimers();

    controller.sendEvent('someCustomEvent');
    jest.advanceTimersByTime(TIMEOUT / 2);

    expect(controller.state.base.activePromo).toBe(null);

    jest.advanceTimersByTime(TIMEOUT / 2);
    jest.useRealTimers();

    await waitForNextTick();

    expect(controller.state.base.activePromo).toBe('promo1');
});

it('can handle several timeouts in event', async () => {
    const TIMEOUT = 1000;

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
                            trigger: {on: 'someCustomEvent', timeout: TIMEOUT * 2},
                        },
                        {
                            slug: 'promo2',
                            conditions: [],
                            trigger: {on: 'someCustomEvent', timeout: TIMEOUT},
                        },
                    ],
                },
            ],
        },
    });

    jest.useFakeTimers();

    controller.sendEvent('someCustomEvent');
    jest.advanceTimersByTime(TIMEOUT / 2);

    expect(controller.state.base.activePromo).toBe(null);

    jest.advanceTimersByTime(TIMEOUT / 2);
    jest.useRealTimers();

    await waitForNextTick();

    expect(controller.state.base.activePromo).toBe('promo2');
});
