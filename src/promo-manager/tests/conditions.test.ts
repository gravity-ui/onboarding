import {Controller} from '../core/controller';

import {testOptions} from './options';

it('promo with NO condition -> runs', async function () {
    const presetWithNoCondition = {
        slug: 'noConditionType',
        promos: [
            {
                slug: 'noConditionPromo',
                conditions: [],
            },
        ],
    };
    const controller = new Controller({...testOptions, config: {presets: [presetWithNoCondition]}});

    await controller.requestStart('noConditionPromo');

    expect(controller.state.base.activePromo).toBe('noConditionPromo');
});

it('promo with false condition -> dont run', async function () {
    const presetWithFalseCondition = {
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
        config: {presets: [presetWithFalseCondition]},
    });

    await controller.requestStart('someConditionPromo');

    expect(controller.state.base.activePromo).toBe(null);
});

describe('json conditions', function () {
    it('take custom helper from config', async function () {
        const controller = new Controller({
            ...testOptions,
            config: {
                presets: [
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
                presets: [
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
                presets: [
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
