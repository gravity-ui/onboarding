import {EventsMap, EventTypes} from './types';
import type {Controller} from './controller';

type Callback = any;
export class EventEmitter<HintParams, Presets extends string, Steps extends string> {
    map: Record<string, Set<any>> = {};

    controllerInstance: Controller<HintParams, Presets, Steps>;

    constructor(controllerInstance: Controller<HintParams, Presets, Steps>) {
        this.controllerInstance = controllerInstance;
    }

    emit = async <T extends EventTypes>(type: T, data: EventsMap<Presets, Steps>[T]) => {
        const listeners = this.map[type];

        if (!listeners || listeners.size === 0) {
            return true;
        }

        let canContinue = true;
        for (const listener of listeners) {
            const result = await listener(data, this.controllerInstance);
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
