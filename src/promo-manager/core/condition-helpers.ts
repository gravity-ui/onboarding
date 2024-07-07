import type {PromoState} from './types';
import {ConditionContext, ConditionHelper} from './types';

const getLastTimeCall = (state: PromoState, {promoType, promoSlug}: ConditionContext) => {
    if (!promoType) {
        return undefined;
    }

    return promoSlug
        ? state.progress?.progressInfoByPromo[promoSlug]?.lastCallTime
        : state.progress?.progressInfoByType[promoType]?.lastCallTime;
};

export const PromoInCurrentDay: ConditionHelper = (date: Date) => {
    return () => date.toDateString() === new Date().toDateString();
};

export const ShowOncePerMonths: ConditionHelper = (months: number) => {
    return (state, ctx) => {
        const dateNow = new Date(ctx.currentDate);

        dateNow.setMonth(dateNow.getMonth() - months);

        const lastTimeCall = getLastTimeCall(state, ctx);

        if (!lastTimeCall) {
            return true;
        }

        return dateNow.getTime() >= lastTimeCall;
    };
};
