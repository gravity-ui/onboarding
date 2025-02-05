import {Controller} from '../core/controller';
import {testOptions} from '../tests/options';
import {PromoTabSyncPlugin} from './promo-tab-sync-plugin';
import {waitForNextTick} from '../tests/utils';

beforeEach(() => {
    window.localStorage.clear();
});

// Wed Jan 15 2025 20:57:54 GMT+0100
const DATE_NOW = 1736971074738;
const DATE_IN_FUTURE = DATE_NOW + 1;
const DATE_IN_PAST = DATE_NOW - 1;

it('finish promo -> save value to LS', async () => {
    const controller = new Controller({
        ...testOptions,
        plugins: [
            new PromoTabSyncPlugin({
                stateLSKey: 'someKey',
                __UNSTABLE__syncState: true,
            }),
        ],
        dateNow: () => DATE_NOW,
    });

    await controller.ensureInit();
    controller.finishPromo('boardPoll');

    const value = JSON.parse(localStorage.getItem('someKey') ?? '');

    expect(value).toEqual({
        date: DATE_NOW,
        value: {
            finishedPromos: ['boardPoll'],
            progressInfoByPromo: {
                boardPoll: {
                    lastCallTime: DATE_NOW,
                },
            },
        },
    });
});

it('cancel promo -> save value to LS', async () => {
    const controller = new Controller({
        ...testOptions,
        plugins: [
            new PromoTabSyncPlugin({
                stateLSKey: 'someKey',
                __UNSTABLE__syncState: true,
            }),
        ],
        dateNow: () => DATE_NOW,
    });

    await controller.ensureInit();
    controller.cancelPromo('boardPoll');

    const value = JSON.parse(localStorage.getItem('someKey') ?? '');

    expect(value).toEqual({
        date: DATE_NOW,
        value: {
            finishedPromos: [],
            progressInfoByPromo: {
                boardPoll: {
                    lastCallTime: DATE_NOW,
                },
            },
        },
    });
});

it('tab focus -> apply value from LS', async () => {
    const controller = new Controller({
        ...testOptions,
        plugins: [
            new PromoTabSyncPlugin({
                stateLSKey: 'someKey',
                __UNSTABLE__syncState: true,
            }),
        ],
        dateNow: () => DATE_IN_PAST,
    });

    await controller.ensureInit();

    const newValue = {
        date: DATE_NOW,
        value: {
            finishedPromos: ['boardPoll'],
            progressInfoByPromo: {
                boardPoll: {
                    lastCallTime: DATE_IN_FUTURE,
                },
            },
        },
    };
    window.localStorage.setItem('someKey', JSON.stringify(newValue));

    // current date > event date
    controller.dateNow = () => DATE_IN_FUTURE;
    document.dispatchEvent(new Event('visibilitychange'));

    await waitForNextTick();

    expect(controller.state.progress).toEqual(newValue.value);
});

it('promo finished in fresh state -> apply fresh progress state', async () => {
    const controller = new Controller({
        ...testOptions,
        plugins: [
            new PromoTabSyncPlugin({
                stateLSKey: 'someKey',
                __UNSTABLE__syncState: true,
            }),
        ],
        dateNow: () => DATE_NOW,
    });

    await controller.ensureInit();
    await controller.requestStart('boardPoll');

    const newValue = {
        date: DATE_IN_FUTURE,
        value: {
            finishedPromos: ['boardPoll'],
            progressInfoByPromo: {
                boardPoll: {
                    lastCallTime: DATE_IN_FUTURE,
                },
            },
        },
    };
    window.localStorage.setItem('someKey', JSON.stringify(newValue));

    // current date > event date
    controller.dateNow = () => DATE_IN_FUTURE;
    document.dispatchEvent(new Event('visibilitychange'));

    await waitForNextTick();

    expect(controller.state.progress).toEqual(newValue.value);
});

it('promo finished in fresh state -> mutate base state', async () => {
    const controller = new Controller({
        ...testOptions,
        plugins: [
            new PromoTabSyncPlugin({
                stateLSKey: 'someKey',
                __UNSTABLE__syncState: true,
            }),
        ],
        dateNow: () => DATE_NOW,
    });

    await controller.ensureInit();
    await controller.requestStart('boardPoll');

    const newValue = {
        date: DATE_IN_FUTURE,
        value: {
            finishedPromos: ['boardPoll'],
            progressInfoByPromo: {
                boardPoll: {
                    lastCallTime: DATE_IN_FUTURE,
                },
            },
        },
    };
    window.localStorage.setItem('someKey', JSON.stringify(newValue));

    // current date > event date
    controller.dateNow = () => DATE_IN_FUTURE;
    document.dispatchEvent(new Event('visibilitychange'));

    await waitForNextTick();
    await waitForNextTick();

    expect(controller.state.base.activePromo).not.toEqual('boardPoll');
});

it('promo canceled in fresh state -> mutate base state', async () => {
    const controller = new Controller({
        ...testOptions,
        plugins: [
            new PromoTabSyncPlugin({
                stateLSKey: 'someKey',
                __UNSTABLE__syncState: true,
            }),
        ],
        dateNow: () => DATE_NOW,
    });

    await controller.ensureInit();
    await controller.requestStart('boardPoll');

    const newValue = {
        date: DATE_IN_FUTURE,
        value: {
            progressInfoByPromo: {
                boardPoll: {
                    lastCallTime: DATE_IN_FUTURE,
                },
            },
        },
    };
    window.localStorage.setItem('someKey', JSON.stringify(newValue));

    // current date > event date
    controller.dateNow = () => DATE_IN_FUTURE;
    document.dispatchEvent(new Event('visibilitychange'));

    await waitForNextTick();

    expect(controller.state.base.activePromo).not.toEqual('boardPoll');
});
it('old value int ls + tab focus -> dont apply change', async () => {
    const controller = new Controller({
        ...testOptions,
        plugins: [
            new PromoTabSyncPlugin({
                stateLSKey: 'someKey',
                __UNSTABLE__syncState: true,
            }),
        ],
        dateNow: () => DATE_NOW,
    });

    await controller.ensureInit();

    const oldValue = {
        date: DATE_IN_PAST, // old data in LS
        value: {
            finishedPromos: ['boardPoll'],
            progressInfoByPromo: {
                boardPoll: {
                    lastCallTime: DATE_NOW,
                },
            },
        },
    };
    window.localStorage.setItem('someKey', JSON.stringify(oldValue));

    // current date > event date
    controller.dateNow = () => DATE_IN_FUTURE;
    document.dispatchEvent(new Event('visibilitychange'));

    await waitForNextTick();

    expect(controller.state.progress?.finishedPromos.length).toBe(0);
    expect(controller.state.progress?.progressInfoByPromo.boardPoll).toBe(undefined);
});
