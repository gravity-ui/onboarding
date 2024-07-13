import type {PromoProgressState} from '../core/types';

import {pollGroup, pollGroup2, pollWithConditions} from './promoGroups';

export const testOptions = {
    config: {
        promoGroups: [pollGroup, pollGroup2, pollWithConditions],
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
        level: 'error' as const,
        logger: {
            debug: () => {},
            error: () => {},
        },
    },
};
