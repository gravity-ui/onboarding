import {Logger} from '../../../logger';
import {ConditionContext, PromoState} from '../types';
import dayjs from 'dayjs';
import {getProgressForGroup} from '../utils/getProgressForGroup';

export const getLastTimeCall = (state: PromoState, ctx: ConditionContext, slug?: string) => {
    if (!slug || !state.progress) {
        return undefined;
    }

    const timeForPromo = state.progress?.progressInfoByPromo[slug]?.lastCallTime;
    const timeForType = getProgressForGroup(state.progress, ctx.config, slug)?.lastCallTime;

    return timeForPromo || timeForType;
};

export const getTimeFromLastCallInMs = (state: PromoState, ctx: ConditionContext) => {
    const nowDate = dayjs(ctx.currentDate);

    const lastTimeCall = getLastTimeCall(state, ctx, ctx.promoSlug || ctx.promoType);

    if (!lastTimeCall) {
        return Infinity;
    }
    const timeFromLastCall = dayjs.duration(nowDate.diff(dayjs(lastTimeCall)));

    return timeFromLastCall.asMilliseconds();
};

export const isFinishedPromo = (state: PromoState, ctx: ConditionContext, logger: Logger) => {
    if (!ctx.promoSlug) {
        logger.error('Promo is not provided');

        return false;
    }

    return state.progress?.finishedPromos.includes(ctx.promoSlug) ?? false;
};
