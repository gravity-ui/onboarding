import {useMemo, useSyncExternalStore} from 'react';

import type {Controller} from './controller';
import type {PresetSlug, PromoSlug} from './types';

export function getHooks(controller: Controller) {
    const usePromoManager = (promo: PromoSlug) => {
        const status = useSyncExternalStore(controller.subscribe, () =>
            controller.getPromoStatus(promo),
        );

        const callbacks = useMemo(
            () => ({
                status,
                requestStart: () => {
                    controller.requestStart(promo).catch((error) => {
                        controller.logger.error(error);
                    });
                },
                finish: (updateProgressInfo = false, closeActiveTimeout = 0) =>
                    controller.finishPromo(promo, updateProgressInfo, closeActiveTimeout),
                cancel: (updateProgressInfo = false, closeActiveTimeout = 0) =>
                    controller.cancelPromo(promo, updateProgressInfo, closeActiveTimeout),
                cancelStart: () => controller.cancelStart(promo),
                updateProgressInfo: () => controller.updateProgressInfo(promo),
            }),
            [promo, status],
        );

        return callbacks;
    };

    const useActivePromo = (presetSlug?: PresetSlug) => {
        const promo = useSyncExternalStore(controller.subscribe, () =>
            controller.getActivePromo(presetSlug),
        );

        const callbacks = useMemo(
            () => ({
                promo,
                preset: controller.getTypeBySlug(promo),
                metaInfo: () => controller.getPromoConfig(promo),
                finish: (updateProgressInfo = false, closeActiveTimeout = 0) =>
                    controller.finishPromo(promo, updateProgressInfo, closeActiveTimeout),
                cancel: (updateProgressInfo = false, closeActiveTimeout = 0) =>
                    controller.cancelPromo(promo, updateProgressInfo, closeActiveTimeout),
                cancelStart: () => controller.cancelStart(promo),
                updateProgressInfo: () => controller.updateProgressInfo(promo),
            }),
            [promo],
        );

        return callbacks;
    };

    const useAvailablePromo = (type: PresetSlug) => {
        const promo = useSyncExternalStore(controller.subscribe, () =>
            controller.getFirstAvailablePromoByType(type),
        );

        const callbacks = useMemo(
            () => ({
                promo,
                requestStart: () => controller.requestStart(promo),
                finish: (updateProgressInfo = false, closeActiveTimeout = 0) =>
                    controller.finishPromo(promo, updateProgressInfo, closeActiveTimeout),
                cancel: (updateProgressInfo = false, closeActiveTimeout = 0) =>
                    controller.cancelPromo(promo, updateProgressInfo, closeActiveTimeout),
            }),
            [promo],
        );

        return callbacks;
    };

    return {
        usePromoManager,
        useAvailablePromo,
        useActivePromo,
    };
}
