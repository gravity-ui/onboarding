import {useMemo, useSyncExternalStore} from 'react';

import type {Controller} from './controller';
import type {PresetSlug, PromoSlug} from './types';
import {assertSlug} from './utils/assertSlug';

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
                cancel: (updateProgressInfo = false) =>
                    controller.cancelPromo(promo, updateProgressInfo),
                cancelStart: () => controller.cancelStart(promo),
                updateProgressInfo: () => controller.updateProgressInfo(promo),
            }),
            [promo, status],
        );

        return callbacks;
    };

    const useActivePromo = (presetSlug?: PresetSlug) => {
        const promo = useSyncExternalStore(
            controller.subscribe,
            () => controller.state.base.activePromo,
        );
        const preset = promo ? assertSlug(controller.getTypeBySlug(promo), presetSlug) : null;
        const isValid = promo && preset;

        const callbacks = useMemo(
            () => ({
                promo: isValid ? promo : null,
                preset,
                metaInfo: isValid ? controller.getPromoConfig(promo) : null,
                finish: (updateProgressInfo = false, closeActiveTimeout = 0) =>
                    isValid
                        ? controller.finishPromo(promo, updateProgressInfo, closeActiveTimeout)
                        : {},
                cancel: (updateProgressInfo = false) =>
                    isValid ? controller.cancelPromo(promo, updateProgressInfo) : {},
                cancelStart: () => (isValid ? controller.cancelStart(promo) : {}),
                updateProgressInfo: () => (isValid ? controller.updateProgressInfo(promo) : {}),
            }),
            [preset, promo],
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
                requestStart: () => (promo ? controller.requestStart(promo) : {}),
                finish: (updateProgressInfo = false, closeActiveTimeout = 0) =>
                    promo
                        ? controller.finishPromo(promo, updateProgressInfo, closeActiveTimeout)
                        : {},
                cancel: (updateProgressInfo = false) =>
                    promo ? controller.cancelPromo(promo, updateProgressInfo) : {},
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
