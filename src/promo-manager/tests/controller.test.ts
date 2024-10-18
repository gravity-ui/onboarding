import {Controller} from '../core/controller';

import {testOptions} from './options';
import {testMetaInfo} from './promoGroups';
import {waitForNextTick} from './utils';
import {PromoGroup} from '../core/types';

describe('active promo', () => {
    let controller: Controller;

    beforeEach(() => {
        controller = new Controller(testOptions);
    });

    describe('requestStart', function () {
        test('run one promo', async () => {
            await controller.requestStart('boardPoll');

            expect(controller.state.base.activePromo).toBe('boardPoll');
        });

        test('run one promo not from the config', async () => {
            await controller.requestStart('boardPollFake');

            expect(controller.state.base.activePromo).toBe(null);
        });

        it('wait init, then start', async function () {
            controller.requestStart('boardPoll');
            await controller.ensureInit();

            expect(controller.state.base.activePromo).toBe('boardPoll');
        });

        describe('return value', function () {
            it('can start now -> return true', async function () {
                const result = await controller.requestStart('boardPoll');

                expect(result).toBe(true);
            });

            it('2 request before init -> return true', async function () {
                const promise1 = controller.requestStart('boardPoll');
                const promise2 = controller.requestStart('boardPoll');

                const [result1, result2] = await Promise.all([promise1, promise2]);

                expect(result1).toBe(true);
                expect(result2).toBe(true);
                expect(controller.state.base.activePromo).toBe('boardPoll');
            });

            it('undefined promo -> return false', async function () {
                const result = await controller.requestStart('boardPollFake');

                expect(result).toBe(false);
            });

            it('already started -> return true', async function () {
                await controller.requestStart('boardPoll');
                const result = await controller.requestStart('boardPoll');

                expect(result).toBe(true);
            });

            it('pending -> return false', async function () {
                await controller.requestStart('boardPoll');
                await controller.requestStart('boardPoll');
                const result = await controller.requestStart('ganttPoll');

                expect(result).toBe(false);
            });

            it("can't start now -> return false", async function () {
                await controller.requestStart('boardPoll');
                const result = await controller.requestStart('ganttPoll');

                expect(result).toBe(false);
            });
        });
    });

    it('finish promo -> trigger next', async () => {
        await controller.requestStart('boardPoll');
        await controller.requestStart('ganttPoll');

        await controller.finishPromo('boardPoll');

        expect(controller.state.base.activePromo).toBe('ganttPoll');
    });

    it('2 request and finish promo -> not trigger next', async () => {
        await controller.requestStart('boardPoll');
        await controller.requestStart('boardPoll');

        controller.finishPromo('boardPoll');

        expect(controller.state.base.activePromo).toBe(null);
    });
});

describe('promo status', function () {
    it('no progress -> forbidden', function () {
        const controller = new Controller({...testOptions, progressState: undefined});

        const status = controller.getPromoStatus('boardPoll');

        expect(status).toBe('forbidden');
    });

    it('active promo -> active', async function () {
        const controller = new Controller(testOptions);
        await controller.requestStart('boardPoll');

        const status = controller.getPromoStatus('boardPoll');

        expect(status).toBe('active');
    });

    it('common finished promo -> finished', async function () {
        const controller = new Controller(testOptions);
        await controller.requestStart('boardPoll');
        await controller.finishPromo('boardPoll');

        const status = controller.getPromoStatus('boardPoll');

        expect(status).toBe('finished');
    });

    it('promo in queue -> pending', async function () {
        const controller = new Controller(testOptions);
        await controller.requestStart('ganttPoll');
        await controller.requestStart('boardPoll');

        const status = controller.getPromoStatus('boardPoll');

        expect(status).toBe('pending');
    });

    it('pass conditions -> canRun', async function () {
        const controller = new Controller(testOptions);

        const status = controller.getPromoStatus('boardPoll');

        expect(status).toBe('canRun');
    });

    it('not pass conditions -> forbidden', async function () {
        const controller = new Controller(testOptions);

        const status = controller.getPromoStatus('pastDayPoll');

        expect(status).toBe('forbidden');
    });

    it('undefined promo -> forbidden', async function () {
        const controller = new Controller(testOptions);

        const status = controller.getPromoStatus('boardPollFake');

        expect(status).toBe('forbidden');
    });

    it('deleted promo with progress promo -> return false', async function () {
        const controller = new Controller({
            ...testOptions,
            progressState: {
                finishedPromos: ['boardPollFake'],
                progressInfoByPromo: {
                    boardPollFake: {
                        lastCallTime: Date.now(),
                    },
                },
            },
        });

        const status = controller.getPromoStatus('boardPollFake');

        expect(status).toBe('finished');
    });

    describe('repeatable promos', function () {
        it('repeatable finished promo -> canReRun', async function () {
            const controller = new Controller(testOptions);
            await controller.requestStart('boardPollRepeatable');
            await controller.finishPromo('boardPollRepeatable');

            const status = controller.getPromoStatus('boardPollRepeatable');

            expect(status).toBe('canReRun');
        });

        it('repeatable promo not pass conditions  -> forbidden', async function () {
            const controller = new Controller(testOptions);
            await controller.requestStart('forbiddenRepeatablePoll');
            await controller.finishPromo('forbiddenRepeatablePoll');

            const status = controller.getPromoStatus('forbiddenRepeatablePoll');

            expect(status).toBe('forbidden');
        });

        it('finished promo in repeatable group', async function () {
            const repeatableGroup: PromoGroup = {
                slug: 'pollRepeat',
                repeatable: true,
                conditions: [],
                promos: [
                    {
                        slug: 'boardPollRepeatable',
                        conditions: [],
                    },
                ],
            };

            const controller = new Controller({
                ...testOptions,
                config: {
                    promoGroups: [repeatableGroup],
                },
            });
            await controller.requestStart('boardPollRepeatable');
            await controller.finishPromo('boardPollRepeatable');

            const status = controller.getPromoStatus('boardPollRepeatable');

            expect(status).toBe('canReRun');
        });
    });
});

describe('repeated runs', function () {
    it('common promo -> cannot run', async function () {
        const controller = new Controller(testOptions);

        await controller.requestStart('boardPoll');
        await controller.finishPromo('boardPoll');

        await controller.requestStart('boardPoll');

        expect(controller.state.base.activePromo).toBe(null);
    });

    it('repeated promo -> can rerun', async function () {
        const controller = new Controller(testOptions);

        await controller.requestStart('boardPollRepeatable');
        await controller.finishPromo('boardPollRepeatable');

        await controller.requestStart('boardPollRepeatable');

        expect(controller.state.base.activePromo).toBe('boardPollRepeatable');
    });
});

describe('update last call info', () => {
    let controller: Controller;
    const promo = 'boardPoll';

    beforeEach(async () => {
        controller = new Controller(testOptions);
        await controller.requestStart(promo);
    });

    it('start promo -> not save progress', () => {
        expect(controller.state.base.activePromo).toBe(promo);

        expect(controller.state.progress?.progressInfoByPromo[promo]).not.toBeDefined();
    });

    it('finish and save time', () => {
        controller.finishPromo(promo);

        expect(controller.state.progress?.progressInfoByPromo[promo]?.lastCallTime).toBeDefined();
    });

    it('cancel and save time', () => {
        controller.cancelPromo(promo);

        expect(controller.state.progress?.progressInfoByPromo[promo]?.lastCallTime).toBeDefined();
    });
});

describe('close with timeout', () => {
    let controller: Controller;
    const promo = 'boardPoll';
    const clearActiveTimeout = 1000;

    beforeEach(async () => {
        controller = new Controller(testOptions);
        await controller.requestStart(promo);
    });

    it('finish and save time', async () => {
        controller.finishPromo(promo, clearActiveTimeout);

        expect(controller.state.progress?.progressInfoByPromo[promo]?.lastCallTime).toBeDefined();
        expect(controller.state.base.activePromo).toBe(promo);

        await waitForNextTick(clearActiveTimeout);

        expect(controller.state.base.activePromo).toBe(null);
    });

    it('cancel and save time', async () => {
        jest.useFakeTimers();
        controller.cancelPromo(promo, clearActiveTimeout);

        expect(controller.state.progress?.progressInfoByPromo[promo]?.lastCallTime).toBeDefined();
        expect(controller.state.base.activePromo).toBe(promo);

        jest.advanceTimersByTime(clearActiveTimeout);
        jest.useRealTimers();

        expect(controller.state.base.activePromo).toBe(null);
    });
});

describe('meta info', () => {
    let controller: Controller;
    const promo = 'boardPoll';

    beforeEach(async () => {
        controller = new Controller(testOptions);
        controller.requestStart(promo);

        await controller.ensureInit();
    });

    it('promo with meta info', async () => {
        const metaInfo = controller.getPromoMeta('boardPoll');

        expect(metaInfo).toEqual(testMetaInfo);
    });

    it('promo without with meta info', async () => {
        const metaInfo = controller.getPromoMeta('ganttPoll');

        expect(metaInfo).toEqual({});
    });
});

it('reset progress -> default state', function () {
    const controller = new Controller(testOptions);
    controller.resetToDefaultState();

    expect(controller.state.progress).toEqual({
        finishedPromos: [],
        progressInfoByPromo: {},
    });
});
