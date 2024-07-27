import {ConditionContext, PromoState} from '../types';
import dayjs from 'dayjs';

export const getLastTimeCall = (state: PromoState, slug?: string) => {
    if (!slug) {
        return undefined;
    }

    const timeForPromo = state.progress?.progressInfoByPromo[slug]?.lastCallTime;
    const timeForType = state.progress?.progressInfoByPromoGroup[slug]?.lastCallTime;

    return timeForPromo || timeForType;
};

export const getTimeFromLastCallInMs = (state: PromoState, ctx: ConditionContext) => {
    const nowDate = dayjs(ctx.currentDate);

    const lastTimeCall = getLastTimeCall(state, ctx.promoSlug || ctx.promoType);

    if (!lastTimeCall) {
        return Infinity;
    }
    const timeFromLastCall = dayjs.duration(nowDate.diff(dayjs(lastTimeCall)));

    return timeFromLastCall.asMilliseconds();
};
