import {useMemo, useSyncExternalStore} from 'react';

import type {Controller} from './controller';
import type {PromoGroupSlug, PromoSlug} from './types';

export function getHooks(controller: Controller) {
    const usePromoManager = () => {
        const activePromo = useSyncExternalStore(
            controller.subscribe,
            () => controller.state.base.activePromo,
        );

        return useMemo(
            () => ({
                activePromo,
                requestStartPromo: controller.requestStart,
                finisPromo: controller.finishPromo,
                cancelPromo: controller.cancelPromo,
                skipPromo: controller.skipPromo,
            }),
            [activePromo],
        );
    };

    const usePromo = (promo: PromoSlug) => {
        const status = useSyncExternalStore(controller.subscribe, () =>
            controller.getPromoStatus(promo),
        );

        return useMemo(
            () => ({
                status,
                requestStart: () => controller.requestStart(promo),
                finish: (closeActiveTimeout?: number) =>
                    controller.finishPromo(promo, closeActiveTimeout),
                cancel: (closeActiveTimeout?: number) =>
                    controller.cancelPromo(promo, closeActiveTimeout),
                skip: () => controller.skipPromo(promo),
            }),
            [status],
        );
    };

    const useActivePromo = (promoGroupSlug?: PromoGroupSlug) => {
        const promo = useSyncExternalStore(controller.subscribe, () =>
            controller.getActivePromo(promoGroupSlug),
        );

        return useMemo(
            () => ({
                promo,
                promoGroup: controller.getGroupBySlug(promo),
                metaInfo: controller.getPromoMeta(promo),
                finish: (closeActiveTimeout?: number) =>
                    controller.finishPromo(promo, closeActiveTimeout),
                cancel: (closeActiveTimeout?: number) =>
                    controller.cancelPromo(promo, closeActiveTimeout),
                skipPromo: () => controller.skipPromo(promo),
                updateProgressInfo: () => controller.updateProgressInfo(promo),
            }),
            [promo],
        );
    };

    return {
        usePromoManager,
        usePromo,
        useActivePromo,
    };
}
