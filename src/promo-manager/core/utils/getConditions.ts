import type {Conditions, Presets} from '../types';

export const getConditions = (presets: Presets): Conditions => {
    const conditions: Conditions = {
        typeConditions: {},
        promoConditions: {},
    };

    for (const preset of presets) {
        conditions.typeConditions[preset.slug] = preset.conditions ?? [];

        for (const promo of preset.promos) {
            conditions.promoConditions[promo.slug] = promo.conditions ?? [];
        }
    }

    return conditions;
};
