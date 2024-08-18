import {useMemo, useSyncExternalStore} from 'react';

import type {Controller} from './controller';
import type {PromoGroupSlug, PromoSlug} from './types';

export function getHooks(controller: Controller) {
    const usePromoManager = (promo: PromoSlug) => {
        const status = useSyncExternalStore(controller.subscribe, () =>
            controller.getPromoStatus(promo),
        );

        return useMemo(
            () => ({
                status,
                requestStart: () => {
                    controller.requestStart(promo).catch((error) => {
                        controller.logger.error(error);
                    });
                },
                finish: (closeActiveTimeout?: number) =>
                    controller.finishPromo(promo, closeActiveTimeout),
                cancel: (closeActiveTimeout?: number) =>
                    controller.cancelPromo(promo, closeActiveTimeout),
                skipPromo: () => controller.skipPromo(promo),
                updateProgressInfo: () => controller.updateProgressInfo(promo),
            }),
            [promo, status],
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

    const useAvailablePromo = (group: PromoGroupSlug) => {
        const promo = useSyncExternalStore(controller.subscribe, () =>
            controller.getFirstAvailablePromoFromGroup(group),
        );

        return useMemo(
            () => ({
                promo,
                requestStart: () => controller.requestStart(promo),
                finish: (closeActiveTimeout?: number) =>
                    controller.finishPromo(promo, closeActiveTimeout),
                cancel: (closeActiveTimeout?: number) =>
                    controller.cancelPromo(promo, closeActiveTimeout),
            }),
            [promo],
        );
    };

    return {
        usePromoManager,
        useAvailablePromo,
        useActivePromo,
    };
}
