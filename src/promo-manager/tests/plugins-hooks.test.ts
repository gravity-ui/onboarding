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

    it('finishPromo', async function () {
        const controller = new Controller(testOptions);

        const mock = jest.fn();
        controller.events.subscribe('finishPromo', mock);

        await controller.ensureInit();
        controller.finishPromo('boardPoll');

        expect(mock).toHaveBeenCalled();

        expect(mock.mock.calls[0][0]).toEqual({slug: 'boardPoll'});
    });

    it('finishPromo same promo twice -> emit event only once', async function () {
        const controller = new Controller(testOptions);

        const mock = jest.fn();
        controller.events.subscribe('finishPromo', mock);

        await controller.ensureInit();

        controller.finishPromo('boardPoll');
        expect(mock).toHaveBeenCalledTimes(1);

        controller.finishPromo('boardPoll');
        expect(mock).toHaveBeenCalledTimes(1); // Still called only once
    });

    it('finishPromo different promos -> emit for each', async function () {
        const controller = new Controller(testOptions);

        const mock = jest.fn();
        controller.events.subscribe('finishPromo', mock);

        await controller.ensureInit();

        controller.finishPromo('boardPoll');
        expect(mock).toHaveBeenCalledTimes(1);

        controller.finishPromo('ganttPoll');
        expect(mock).toHaveBeenCalledTimes(2);
    });

    it('cancelPromo', async function () {
        const controller = new Controller(testOptions);

        const mock = jest.fn();
        controller.events.subscribe('cancelPromo', mock);

        await controller.ensureInit();

        await controller.requestStart('boardPoll');
        controller.cancelPromo('boardPoll');

        expect(mock).toHaveBeenCalled();

        expect(mock.mock.calls[0][0]).toEqual({slug: 'boardPoll'});
    });
});
