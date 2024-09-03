import {Controller} from './controller';
import {getHooks} from './getHooks';
import type {PromoOptions} from './types';

const getDebug = () => {
    if (typeof window === 'undefined') {
        return false;
    }

    const isDebugModeEnabled = Boolean(window.localStorage.getItem('debugPromoManager'));

    return isDebugModeEnabled;
};

export function createPromoManager(options: PromoOptions) {
    const controller = new Controller({...options, debugMode: getDebug()});

    const {usePromoManager, useActivePromo, usePromo} = getHooks(controller);

    return {
        usePromoManager,
        useActivePromo,
        usePromo,
        controller,
    };
}
