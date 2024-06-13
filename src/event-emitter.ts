import {EventsMap, EventTypes} from './types';

type Callback = any;
export class EventEmitter<Arg> {
    map: Record<string, Set<any>> = {};

    extraArg?: Arg;

    constructor(extraArg?: Arg) {
        this.extraArg = extraArg;
    }

    emit = async <T extends EventTypes>(type: T, data: EventsMap[T]) => {
        const listeners = this.map[type];

        if (!listeners || listeners.size === 0) {
            return true;
        }

        let canContinue = true;
        for (const listener of listeners) {
            const result = await listener(data, this.extraArg);
            if (result === false) {
                canContinue = false;
            }
        }

        return canContinue;
    };

    subscribe = <T extends EventTypes>(type: T, callback: Callback) => {
        if (!this.map[type]) {
            this.map[type] = new Set();
        }

        this.map[type].add(callback);
    };

    unsubscribe = <T extends EventTypes>(type: T, callback: Callback) => {
        if (!this.map[type]) {
            return;
        }

        this.map[type].delete(callback);
    };
}
