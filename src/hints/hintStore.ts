import type {MutableRefObject} from 'react';
import type {ShowHintParams} from '../types';
import {EventEmitter} from '../event-emitter';
import {EventListener} from '../types';

export type HintState<HintParams, Preset extends string, Steps extends string> = {
    anchorRef: MutableRefObject<HTMLElement | null>;
    open: boolean;
    hint?: Pick<ShowHintParams<HintParams, Preset, Steps>, 'preset' | 'step'>;
};

export class HintStore<HintParams, Preset extends string, Steps extends string> {
    state: HintState<HintParams, Preset, Steps> = {
        open: false,
        anchorRef: {current: null},
        hint: undefined,
    };

    emitter: EventEmitter<any>;

    constructor(emitter: EventEmitter<any>) {
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

    updateHintAnchor = ({element, step}: {element: HTMLElement | null; step: Steps}) => {
        if (this.state.hint?.step?.slug !== step) {
            return;
        }

        this.state = {
            ...this.state,
            anchorRef: {current: element},
        };

        this.emitter.emit('hintDataChanged', {state: this.state});
    };

    closeHint = () => {
        if (this.state.hint) {
            this.emitter.emit('closeHint', {step: this.state.hint.step.slug});
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
