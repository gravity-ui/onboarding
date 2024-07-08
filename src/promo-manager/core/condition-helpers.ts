import type {PromoState} from './types';
import {ConditionContext, ConditionHelper} from './types';

import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

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

export const ShowOnceForPeriod: ConditionHelper = (
    ...params: Parameters<typeof dayjs.duration>
) => {
    return (state, ctx) => {
        const targetInterval = dayjs.duration(...params);

        const nowDate = dayjs(ctx.currentDate);

        const lastTimeCall = getLastTimeCall(state, ctx);
        const lastCallDate = dayjs(lastTimeCall);

        const timeFromLastCall = dayjs.duration(nowDate.diff(lastCallDate));

        if (!lastTimeCall) {
            return true;
        }

        return timeFromLastCall.asMilliseconds() > targetInterval.asMilliseconds();
    };
};
