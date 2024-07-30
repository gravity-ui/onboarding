import type {PromoProgressState} from '../core/types';

import {pollGroup, pollGroup2, pollWithConditions} from './promoGroups';

export const testOptions = {
    config: {
        promoGroups: [pollGroup, pollGroup2, pollWithConditions],
        init: {
            initType: 'timeout' as const,
            timeout: 0,
        },
    },
    progressState: {
        finishedPromos: [],
        progressInfoByPromoGroup: {},
        progressInfoByPromo: {},
    },
    getProgressState: () =>
        new Promise<PromoProgressState>(() => ({
            finishedPromos: [],
            progressInfoByPromoGroup: {},
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
