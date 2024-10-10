import {Controller} from './controller';
import {getHooks} from './getHooks';
import type {PromoOptions} from './types';

const getDebug = (options: PromoOptions) => {
    if (typeof window === 'undefined') {
        return false;
    }

    const isDebugEnabledInLs = Boolean(window.localStorage.getItem('debugPromoManager'));
    const isDebugEnabledInConfig = Boolean(options.debugMode);

    return isDebugEnabledInConfig || isDebugEnabledInLs;
};

export function createPromoManager(options: PromoOptions) {
    const controller = new Controller({...options, debugMode: getDebug(options)});

    const {usePromoManager, useActivePromo, usePromo} = getHooks(controller);

    return {
        usePromoManager,
        useActivePromo,
        usePromo,
        controller,
    };
}
