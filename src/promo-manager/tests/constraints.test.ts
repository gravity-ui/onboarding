import {Controller} from '../core/controller';
import {testOptions} from './options';
import {Condition} from '../core/types';

const getOptions = () => ({
    ...testOptions,
    config: {
        promoGroups: [
            {
                slug: 'someType',
                promos: [
                    {
                        slug: 'someSlug',
                        conditions: [],
                    },
                    {
                        slug: 'someSlug2',
                        conditions: [],
                    },
                ],
            },
        ],
        constraints: [] as Condition[],
    },
    conditionHelpers: {},
});

it('empty constraints -> run', async function () {
    const options = getOptions();
    options.config.constraints = [];
    const controller = new Controller(options);

    await controller.requestStart('someSlug');

    expect(controller.state.base.activePromo).toBe('someSlug');
});

it('false in constraints -> dont run', async function () {
    const options = getOptions();
    options.config.constraints = [() => true, () => false];
    const controller = new Controller(options);

    await controller.requestStart('someSlug');

    expect(controller.state.base.activePromo).toBe(null);
});

it('true in constraints -> run', async function () {
    const options = getOptions();
    options.config.constraints = [() => true, () => true];
    const controller = new Controller(options);

    await controller.requestStart('someSlug');

    expect(controller.state.base.activePromo).toBe('someSlug');
});

it('can use json helpers', async function () {
    const options = getOptions();
    options.config.constraints = [
        {
            helper: 'someConstraint',
        },
    ];
    const mock = jest.fn(() => () => false);
    options.conditionHelpers = {someConstraint: mock};
    const controller = new Controller(options);

    await controller.requestStart('someSlug');

    expect(controller.state.base.activePromo).toBe(null);
    expect(mock).toHaveBeenCalled();
});

it('can pass arg to helper', async function () {
    const options = getOptions();
    options.config.constraints = [
        {
            helper: 'someConstraint',
            args: [123],
        },
    ];
    const mock = jest.fn(() => () => false);
    options.conditionHelpers = {someConstraint: mock};
    const controller = new Controller(options);

    await controller.requestStart('someSlug');

    expect(controller.state.base.activePromo).toBe(null);
    expect(mock).toHaveBeenCalledWith(123);
});
