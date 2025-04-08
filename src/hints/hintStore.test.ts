import {HintStore} from './hintStore';
import {EventEmitter} from '../event-emitter';

const stepMock = {slug: 'createSprint', name: '', description: ''};

const showHintParams = {
    element: document.createElement('div'),
    preset: 'createProject',
    step: {slug: 'createSprint', name: '', description: ''},
};

it('empty store snapshot', function () {
    const emitter = new EventEmitter();
    const store = new HintStore(emitter);
    expect(store.getSnapshot()).toEqual({
        anchorRef: {current: null},
        hint: undefined,
        open: false,
    });
});

it('show hint -> emit callback', function () {
    const fn = jest.fn();

    const emitter = new EventEmitter();
    const store = new HintStore(emitter);
    store.subscribe(fn);
    store.showHint(showHintParams);

    expect(fn).toHaveBeenCalled();
});

it('show hint -> state for open hint', function () {
    const fn = jest.fn();

    const emitter = new EventEmitter();
    const store = new HintStore(emitter);
    store.subscribe(fn);
    store.showHint(showHintParams);

    const snapshot = store.getSnapshot();

    expect(snapshot.open).toBe(true);
    expect(snapshot.hint).toEqual({
        preset: 'createProject',
        step: stepMock,
    });
    expect(snapshot.anchorRef.current).toBeDefined();
});

it('close hint -> state for closed hint', function () {
    const fn = jest.fn();

    const emitter = new EventEmitter();
    const store = new HintStore(emitter);
    store.subscribe(fn);
    store.showHint(showHintParams);
    store.closeHint();

    expect(store.getSnapshot().open).toBe(false);
});

it('unsubscribe -> no emit callback', function () {
    const fn = jest.fn();

    const emitter = new EventEmitter();
    const store = new HintStore(emitter);
    const unsubscribe = store.subscribe(fn);
    unsubscribe();

    store.showHint(showHintParams);

    expect(fn).not.toHaveBeenCalled();
});

it('update -> new state object', function () {
    const fn = jest.fn();

    const emitter = new EventEmitter();
    const store = new HintStore(emitter);
    const unsubscribe = store.subscribe(fn);
    unsubscribe();

    const snapshot1 = store.getSnapshot();

    store.showHint(showHintParams);
    const snapshot2 = store.getSnapshot();

    expect(snapshot1).not.toBe(snapshot2);
});

describe('works with different context', function () {
    // eslint-disable-next-line
    class Runner<T extends (...args: any) => any> {
        run(cb: T, param?: Parameters<T>[0]): ReturnType<T> {
            return cb(param);
        }
    }

    const runner = new Runner();

    it('subscribe, show hint, close hint', function () {
        const fn = jest.fn();

        const emitter = new EventEmitter();
        const store = new HintStore(emitter);
        runner.run(store.subscribe, fn);
        runner.run(store.showHint, showHintParams);
        runner.run(store.closeHint, showHintParams);

        expect(fn).toHaveBeenCalledTimes(2);
    });
});
