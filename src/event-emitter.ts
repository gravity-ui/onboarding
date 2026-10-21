import {EventListener} from './types';

export class EventEmitter<
    EventTypes extends string,
    EventsMap extends {[P in EventTypes]: any},
    Arg,
> {
    map: Record<string, Set<any>> = {};

    extraArg?: Arg;

    constructor(extraArg?: Arg) {
        this.extraArg = extraArg;
    }

    emit = async <T extends EventTypes>(type: T, data: EventsMap[T], continueOnError = false) => {
        let canContinue = true;
        let firstError: {reason: unknown} | undefined;
        for (const listener of this.map[type] ?? []) {
            try {
                if ((await listener(data, this.extraArg)) === false) {
                    canContinue = false;
                }
            } catch (error) {
                if (!continueOnError) {
                    throw error;
                }
                firstError ??= {reason: error};
            }
        }

        if (firstError) {
            throw firstError.reason;
        }

        return canContinue;
    };

    subscribe = <T extends EventTypes>(type: T, callback: EventListener) => {
        (this.map[type] ??= new Set()).add(callback);
    };

    unsubscribe = <T extends EventTypes>(type: T, callback: EventListener) => {
        this.map[type]?.delete(callback);
    };
}
