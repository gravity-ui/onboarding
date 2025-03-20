import {Controller} from './controller';
import {getHooks} from './getHooks';
import type {PromoOptions} from './types';
import React, {useEffect, useSyncExternalStore} from 'react';

let controllerRef: Controller;

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

    controllerRef = controller;

    const {usePromoManager, useActivePromo, usePromo} = getHooks(controller);

    return {
        usePromoManager,
        useActivePromo,
        usePromo,
        controller,
    };
}

type Props = {children: React.ReactNode; showOnPromo: string};
export const PromoWrapper = ({children, showOnPromo}: Props) => {
    const status = useSyncExternalStore(controllerRef.subscribe, () =>
        controllerRef.getPromoStatus(showOnPromo),
    );

    useEffect(() => {
        controllerRef.requestStart(showOnPromo);

        return () => {
            controllerRef.cancelPromo(showOnPromo);
        };
    }, []);

    if (status !== 'active') {
        return null;
    }

    return children;
};
