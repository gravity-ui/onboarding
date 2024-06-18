import type {Helpers, Presets, Promo, PromoMeta} from '../types';

const getPriority = (promo: Promo, counter: number) => {
    return promo.priority === 'high' ? -1 : counter;
};

export const getHelpers = (presets: Presets): Helpers => {
    const typeBySlug: {[slug: string]: string} = {};
    const prioritiesBySlug: {[slug: string]: number} = {};
    const metaBySlug: {[slug: string]: PromoMeta} = {};

    let priority = 0;

    for (const preset of presets) {
        for (const promo of preset.promos) {
            typeBySlug[promo.slug] = preset.slug;
            prioritiesBySlug[promo.slug] = getPriority(promo, priority++);
            metaBySlug[promo.slug] = promo.meta || {};
        }
    }

    return {
        typeBySlug,
        prioritiesBySlug,
        metaBySlug,
    };
};
