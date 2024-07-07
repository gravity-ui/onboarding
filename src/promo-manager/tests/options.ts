import type {PromoProgressState} from '../core/types';

import {pollPreset, pollPreset2, pollWithConditions} from './presets';

export const testOptions = {
    config: {
        presets: [pollPreset, pollPreset2, pollWithConditions],
    },
    progressState: {
        finishedPromos: [],
        progressInfoByType: {},
        progressInfoByPromo: {},
    },
    getProgressState: () =>
        new Promise<PromoProgressState>(() => ({
            finishedPromos: [],
            progressInfoByType: {},
            progressInfoByPromo: {},
        })),
    onSave: {
        progress: () => new Promise(() => {}),
    },
    logger: {
        debug: () => {},
        error: () => {},
    },
};
