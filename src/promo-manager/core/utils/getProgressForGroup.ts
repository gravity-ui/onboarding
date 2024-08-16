import {PromoOptions, PromoProgressState} from '../types';

export const getProgressForGroup = (
    state: PromoProgressState,
    config: PromoOptions['config'],
    groupSlug: string,
) => {
    const promoGroup = config.promoGroups.find((group) => group.slug === groupSlug);

    if (!promoGroup) {
        return undefined;
    }
    const lastCallTimes = promoGroup.promos
        .map((promo) => state.progressInfoByPromo[promo.slug]?.lastCallTime)
        .filter((lastCallTime) => Boolean(lastCallTime));

    if (lastCallTimes.length === 0) {
        return undefined;
    }

    return {
        lastCallTime: lastCallTimes.reduce((lastCallTimeForGroup, currentPromoLastCallTime) => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            return currentPromoLastCallTime! > lastCallTimeForGroup!
                ? currentPromoLastCallTime
                : lastCallTimeForGroup;
        }) as number,
    };
};
