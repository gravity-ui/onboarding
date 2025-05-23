import type {MutableRefObject} from 'react';
import type {EventListener, EventTypes, EventsMap, HintCloseSource, ShowHintParams} from '../types';
import {EventEmitter} from '../event-emitter';

export type HintState<HintParams, Preset extends string, Steps extends string> = {
    anchorRef: MutableRefObject<Element | null>;
    open: boolean;
    hint?: Pick<ShowHintParams<HintParams, Preset, Steps>, 'preset' | 'step'>;
};

export class HintStore<HintParams, Preset extends string, Steps extends string> {
    state: HintState<HintParams, Preset, Steps> = {
        open: false,
        anchorRef: {current: null},
        hint: undefined,
    };

    emitter: EventEmitter<EventTypes, EventsMap, any>;

    constructor(emitter: EventEmitter<EventTypes, EventsMap, any>) {
        this.emitter = emitter;
    }

    showHint = ({element, preset, step}: ShowHintParams<HintParams, Preset, Steps>) => {
        this.state = {
            open: true,
            anchorRef: {current: element},
            hint: {preset, step},
        };

        this.emitter.emit('hintDataChanged', {state: this.state});
    };

    updateHintAnchor = ({element, step}: {element: Element | null; step: Steps}) => {
        if (this.state.hint?.step?.slug !== step) {
            return;
        }

        this.state = {
            ...this.state,
            anchorRef: {current: element},
        };

        this.emitter.emit('hintDataChanged', {state: this.state});
    };

    closeHint = (eventSource: HintCloseSource = 'externalEvent') => {
        if (this.state.hint) {
            this.emitter.emit('closeHint', {hint: this.state.hint, eventSource});
        }

        this.state = {
            open: false,
            hint: undefined,
            anchorRef: {current: null},
        };

        this.emitter.emit('hintDataChanged', {state: this.state});
    };

    getSnapshot = () => {
        return this.state;
    };

    subscribe = (listener: EventListener) => {
        this.emitter.subscribe('hintDataChanged', listener);
        return () => {
            this.emitter.unsubscribe('hintDataChanged', listener);
        };
    };
}
