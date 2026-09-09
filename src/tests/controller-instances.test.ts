import {getOptions} from './utils';

it('reports each additional Controller instance through the configured logger', async () => {
    vi.resetModules();
    const {Controller} = await import('../controller');
    const options = getOptions();

    const first = new Controller(options);
    expect(first.logger.error).not.toHaveBeenCalled();

    const second = new Controller(options);
    expect(second.logger.error).toHaveBeenCalledExactlyOnceWith(
        'Should be only one Controller instance for page. Multiple instances can cause inconsistent state and race conditions',
    );

    const third = new Controller(options);
    expect(third.logger.error).toHaveBeenCalledTimes(2);
});
