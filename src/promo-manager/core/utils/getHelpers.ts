import type {Helpers, PromoGroup, Promo, PromoMeta} from '../types';

const getPriority = (promo: Promo, counter: number) => {
    return promo.priority === 'high' ? -1 : counter;
};

export const getHelpers = (promoGroups: PromoGroup[]): Helpers => {
    const typeBySlug: {[slug: string]: string} = {};
    const prioritiesBySlug: {[slug: string]: number} = {};
    const metaBySlug: {[slug: string]: PromoMeta} = {};

    let priority = 0;

    for (const promoGroup of promoGroups) {
        for (const promo of promoGroup.promos) {
            typeBySlug[promo.slug] = promoGroup.slug;
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
