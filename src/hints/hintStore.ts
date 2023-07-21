import type {MutableRefObject} from 'react';
import type {ShowHintParams} from '../types';

type HintState<HintParams, Preset extends string, Steps extends string> = {
    anchorRef: MutableRefObject<HTMLElement | null>;
    open: boolean;
    hint?: Pick<ShowHintParams<HintParams, Preset, Steps>, 'preset' | 'step'>;
};

type Listener = () => void;

export class HintStore<HintParams, Preset extends string, Steps extends string> {
    state: HintState<HintParams, Preset, Steps> = {
        open: false,
        anchorRef: {current: null},
        hint: undefined,
    };
    listeners: Set<Listener>;

    constructor() {
        this.listeners = new Set();
    }

    showHint = ({element, preset, step}: ShowHintParams<HintParams, Preset, Steps>) => {
        this.state = {
            open: true,
            anchorRef: {current: element},
            hint: {preset, step},
        };

        this.emitChange();
    };

    updateHintAnchor = ({element, step}: {element: HTMLElement | null; step: Steps}) => {
        if (this.state.hint?.step?.slug !== step) {
            return;
        }

        this.state = {
            ...this.state,
            anchorRef: {current: element},
        };

        this.emitChange();
    };

    closeHint = () => {
        this.state = {
            open: false,
            hint: undefined,
            anchorRef: {current: null},
        };

        this.emitChange();
    };

    getSnapshot = () => {
        return this.state;
    };

    subscribe = (listener: Listener) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    emitChange = () => {
        for (const listener of this.listeners) {
            listener();
        }
    };
}
