import type {PromoProgressState} from '../core/types';

import {pollGroup, pollGroup2, pollWithConditions, repeatedPoll} from './promoGroups';

export const testOptions = {
    config: {
        promoGroups: [pollGroup, pollGroup2, pollWithConditions, repeatedPoll],
        init: {
            initType: 'timeout' as const,
            timeout: 0,
        },
    },
    progressState: {
        finishedPromos: [],
        progressInfoByPromo: {},
    },
    getProgressState: () =>
        new Promise<PromoProgressState>(() => ({
            finishedPromos: [],
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
