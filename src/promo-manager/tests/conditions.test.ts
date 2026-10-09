import {Controller} from '../core/controller';
import {ShowOnceForSession} from '../core/condition/condition-helpers';

import {testOptions} from './options';

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

it('ShowOnceForSession only limits the promo with the condition', async function () {
    const currentDate = Date.now();
    const controller = new Controller({
        ...testOptions,
        dateNow: () => currentDate,
        config: {
            promoGroups: [
                {
                    slug: 'group',
                    promos: [
                        {slug: 'p1'},
                        {slug: 'p2', repeatable: true, conditions: [ShowOnceForSession()]},
                    ],
                },
            ],
        },
    });

    await controller.requestStart('p1');
    expect(controller.state.base.activePromo).toBe('p1');
    controller.finishPromo('p1');

    await controller.requestStart('p2');
    expect(controller.state.base.activePromo).toBe('p2');
    controller.finishPromo('p2');

    await controller.requestStart('p2');
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
        const mock = vi.fn(() => () => true);
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
