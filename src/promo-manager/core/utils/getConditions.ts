import type {Conditions, PromoGroup} from '../types';

export const getConditions = (groups: PromoGroup[]): Conditions => {
    const conditions: Conditions = {
        typeConditions: {},
        promoConditions: {},
    };

    for (const group of groups) {
        conditions.typeConditions[group.slug] = group.conditions ?? [];

        for (const promo of group.promos) {
            conditions.promoConditions[promo.slug] = promo.conditions ?? [];
        }
    }

    return conditions;
};
