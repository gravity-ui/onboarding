import {Controller} from '../core/controller';
import {testOptions} from './options';

it('plugins in config -> call apply', async function () {
    const plugin = {
        name: 'some plugin',
        apply: jest.fn(),
    };
    const controller = new Controller({...testOptions, plugins: [plugin]});

    const mock = jest.fn();
    controller.events.subscribe('init', mock);

    await controller.ensureInit();

    expect(mock).toHaveBeenCalled();
});

describe('events subscriptions', function () {
    it('init ', async function () {
        const controller = new Controller(testOptions);

        const mock = jest.fn();
        controller.events.subscribe('init', mock);

        await controller.ensureInit();

        expect(mock).toHaveBeenCalled();
    });
});
