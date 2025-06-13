import {EventEmitter} from '../event-emitter';

type TestEvents = {
    testEvent: {data: string};
    asyncEvent: {value: number};
    cancelEvent: {shouldCancel: boolean};
};

describe('EventEmitter', () => {
    let emitter: EventEmitter<keyof TestEvents, TestEvents, string>;

    beforeEach(() => {
        emitter = new EventEmitter<keyof TestEvents, TestEvents, string>('extraArg');
    });

    describe('constructor', () => {
        it('should work without extra argument', () => {
            const emitterWithoutArg = new EventEmitter<keyof TestEvents, TestEvents, undefined>();
            // Test behavior, not internal state
            const listener = jest.fn();
            emitterWithoutArg.subscribe('testEvent', listener);
            emitterWithoutArg.emit('testEvent', {data: 'test'});
            expect(listener).toHaveBeenCalledWith({data: 'test'}, undefined);
        });
    });

    describe('subscribe and unsubscribe behavior', () => {
        it('should call subscribed listeners when event is emitted', async () => {
            const listener = jest.fn();
            emitter.subscribe('testEvent', listener);

            await emitter.emit('testEvent', {data: 'test'});
            expect(listener).toHaveBeenCalledWith({data: 'test'}, 'extraArg');
        });

        it('should call multiple listeners for same event', async () => {
            const listener1 = jest.fn();
            const listener2 = jest.fn();

            emitter.subscribe('testEvent', listener1);
            emitter.subscribe('testEvent', listener2);

            await emitter.emit('testEvent', {data: 'test'});

            expect(listener1).toHaveBeenCalledWith({data: 'test'}, 'extraArg');
            expect(listener2).toHaveBeenCalledWith({data: 'test'}, 'extraArg');
        });

        it('should not call duplicate listeners twice', async () => {
            const listener = jest.fn();

            emitter.subscribe('testEvent', listener);
            emitter.subscribe('testEvent', listener);

            await emitter.emit('testEvent', {data: 'test'});
            expect(listener).toHaveBeenCalledTimes(1);
        });

        it('should not call unsubscribed listeners', async () => {
            const listener = jest.fn();
            emitter.subscribe('testEvent', listener);
            emitter.unsubscribe('testEvent', listener);

            await emitter.emit('testEvent', {data: 'test'});
            expect(listener).not.toHaveBeenCalled();
        });

        it('should handle unsubscribe from non-existent event type', () => {
            const listener = jest.fn();
            expect(() => emitter.unsubscribe('testEvent', listener)).not.toThrow();
        });

        it('should handle unsubscribe of non-existent listener', () => {
            const listener1 = jest.fn();
            const listener2 = jest.fn();

            emitter.subscribe('testEvent', listener1);
            expect(() => emitter.unsubscribe('testEvent', listener2)).not.toThrow();
        });
    });

    describe('emit behavior', () => {
        it('should return true when no listeners exist', async () => {
            const result = await emitter.emit('testEvent', {data: 'test'});
            expect(result).toBe(true);
        });

        it('should return true when all listeners return undefined/void', async () => {
            const listener = jest.fn();
            emitter.subscribe('testEvent', listener);

            const result = await emitter.emit('testEvent', {data: 'test'});
            expect(result).toBe(true);
        });

        it('should return false when any listener returns false', async () => {
            const listener1 = jest.fn().mockReturnValue(true);
            const listener2 = jest.fn().mockReturnValue(false);
            const listener3 = jest.fn().mockReturnValue(true);

            emitter.subscribe('cancelEvent', listener1);
            emitter.subscribe('cancelEvent', listener2);
            emitter.subscribe('cancelEvent', listener3);

            const result = await emitter.emit('cancelEvent', {shouldCancel: true});
            expect(result).toBe(false);
        });

        it('should handle async listeners', async () => {
            const asyncListener = jest.fn().mockResolvedValue(true);
            emitter.subscribe('asyncEvent', asyncListener);

            const result = await emitter.emit('asyncEvent', {value: 42});
            expect(result).toBe(true);
            expect(asyncListener).toHaveBeenCalledWith({value: 42}, 'extraArg');
        });

        it('should handle mix of sync and async listeners', async () => {
            const syncListener = jest.fn().mockReturnValue(true);
            const asyncListener = jest.fn().mockResolvedValue(false);

            emitter.subscribe('asyncEvent', syncListener);
            emitter.subscribe('asyncEvent', asyncListener);

            const result = await emitter.emit('asyncEvent', {value: 42});
            expect(result).toBe(false);
        });

        it('should call all listeners even when one returns false', async () => {
            const listener1 = jest.fn().mockReturnValue(true);
            const listener2 = jest.fn().mockReturnValue(false);
            const listener3 = jest.fn().mockReturnValue(true);

            emitter.subscribe('cancelEvent', listener1);
            emitter.subscribe('cancelEvent', listener2);
            emitter.subscribe('cancelEvent', listener3);

            const result = await emitter.emit('cancelEvent', {shouldCancel: true});

            expect(listener1).toHaveBeenCalled();
            expect(listener2).toHaveBeenCalled();
            expect(listener3).toHaveBeenCalled();
            expect(result).toBe(false);
        });

        it('should handle listener throwing error', async () => {
            const errorListener = jest.fn().mockImplementation(() => {
                throw new Error('Test error');
            });
            const normalListener = jest.fn().mockReturnValue(true);

            emitter.subscribe('testEvent', errorListener);
            emitter.subscribe('testEvent', normalListener);

            await expect(emitter.emit('testEvent', {data: 'test'})).rejects.toThrow('Test error');
        });

        it('should pass correct extra argument to listeners', async () => {
            const listener = jest.fn();
            const customEmitter = new EventEmitter<keyof TestEvents, TestEvents, {custom: string}>({
                custom: 'value',
            });

            customEmitter.subscribe('testEvent', listener);
            await customEmitter.emit('testEvent', {data: 'test'});

            expect(listener).toHaveBeenCalledWith({data: 'test'}, {custom: 'value'});
        });

        it('should handle listeners that return Promise<false>', async () => {
            const asyncFalseListener = jest.fn().mockResolvedValue(false);
            emitter.subscribe('asyncEvent', asyncFalseListener);

            const result = await emitter.emit('asyncEvent', {value: 42});
            expect(result).toBe(false);
        });

        it('should handle listeners that return Promise<undefined>', async () => {
            const asyncUndefinedListener = jest.fn().mockResolvedValue(undefined);
            emitter.subscribe('asyncEvent', asyncUndefinedListener);

            const result = await emitter.emit('asyncEvent', {value: 42});
            expect(result).toBe(true);
        });
    });
});
