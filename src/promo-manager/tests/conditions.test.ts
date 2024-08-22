import {Controller} from '../core/controller';

import {testOptions} from './options';
import {pollWithFinishConditions} from './promoGroups';
import {datePlusMonthsCallback} from './utils';

it('promo with NO condition -> runs', async function () {
    const groupWithNoCondition = {
        slug: 'noConditionType',
        promos: [
            {
                slug: 'noConditionPromo',
                conditions: [],
            },
        ],
    };
    const controller = new Controller({
        ...testOptions,
        config: {promoGroups: [groupWithNoCondition]},
    });

    await controller.requestStart('noConditionPromo');

    expect(controller.state.base.activePromo).toBe('noConditionPromo');
});

it('promo with false condition -> dont run', async function () {
    const groupWithFalseCondition = {
        slug: 'someConditionType',
        promos: [
            {
                slug: 'someConditionPromo',
                conditions: [() => false],
            },
        ],
    };
    const controller = new Controller({
        ...testOptions,
        config: {promoGroups: [groupWithFalseCondition]},
    });

    await controller.requestStart('someConditionPromo');

    expect(controller.state.base.activePromo).toBe(null);
});

describe('json conditions', function () {
    it('take custom helper from config', async function () {
        const controller = new Controller({
            ...testOptions,
            config: {
                promoGroups: [
                    {
                        slug: 'someType',
                        promos: [
                            {
                                slug: 'someSlug',
                                conditions: [
                                    {
                                        helper: 'alwaysTrue',
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
            conditionHelpers: {
                alwaysTrue: () => () => true,
            },
        });

        await controller.requestStart('someSlug');

        expect(controller.state.base.activePromo).toBe('someSlug');
    });

    it('can use arguments', async function () {
        const mock = jest.fn(() => () => true);
        const controller = new Controller({
            ...testOptions,
            config: {
                promoGroups: [
                    {
                        slug: 'someType',
                        promos: [
                            {
                                slug: 'someSlug',
                                conditions: [
                                    {
                                        helper: 'alwaysTrue',
                                        args: ['someParam'],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
            conditionHelpers: {
                alwaysTrue: mock,
            },
        });

        await controller.requestStart('someSlug');

        expect(mock).toHaveBeenCalledWith('someParam');
    });

    it('helper not found -> dont run', async function () {
        const controller = new Controller({
            ...testOptions,
            config: {
                promoGroups: [
                    {
                        slug: 'someType',
                        promos: [
                            {
                                slug: 'someSlug',
                                conditions: [
                                    {
                                        helper: 'undefinedHelper',
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
            conditionHelpers: {
                alwaysTrue: () => () => true,
            },
        });

        await controller.requestStart('someSlug');

        expect(controller.state.base.activePromo).toBe(null);
    });
});

describe('ShowFinishedOnceForPeriod', function () {
    const options = {
        ...testOptions,
        config: {
            promoGroups: [pollWithFinishConditions],
        },
    };

    let controller: Controller;

    beforeEach(() => {
        controller = new Controller(options);
    });

    it('repeat finished promo => not show', async function () {
        controller.finishPromo('repeatFinished');

        await controller.requestStart('repeatFinished');
        expect(controller.state.base.activePromo).toBe(null);

        controller.dateNow = datePlusMonthsCallback(1);
        await controller.requestStart('repeatFinished');

        expect(controller.state.base.activePromo).toBe(null);
    });

    it('repeat finished promo after 2 months => show', async function () {
        controller.finishPromo('repeatFinished');

        await controller.requestStart('repeatFinished');
        expect(controller.state.base.activePromo).toBe(null);

        controller.dateNow = datePlusMonthsCallback(2);
        await controller.requestStart('repeatFinished');

        expect(controller.state.base.activePromo).toBe('repeatFinished');
    });
});

describe('SkipFinished', function () {
    const options = {
        ...testOptions,
        config: {
            promoGroups: [pollWithFinishConditions],
        },
    };

    let controller: Controller;

    beforeEach(() => {
        controller = new Controller(options);
    });

    it('request finished => not show', async function () {
        controller.finishPromo('skipFinished');

        await controller.requestStart('skipFinished');

        expect(controller.state.base.activePromo).toBe(null);
    });

    it('request not finished => show', async function () {
        await controller.requestStart('skipFinished');

        expect(controller.state.base.activePromo).toBe('skipFinished');
    });
});
