import type {PromoState} from '../types';
import {ConditionContext, ConditionHelper} from '../types';

import dayjs from 'dayjs';
import duration, {DurationUnitsObjectType} from 'dayjs/plugin/duration';

dayjs.extend(duration);

export type DurationParam = DurationUnitsObjectType | string;

const getLastTimeCall = (state: PromoState, slug?: string) => {
    if (!slug) {
        return undefined;
    }

    const timeForPromo = state.progress?.progressInfoByPromo[slug]?.lastCallTime;
    const timeForType = state.progress?.progressInfoByType[slug]?.lastCallTime;

    return timeForPromo || timeForType;
};

const getTimeFromLastCallInMs = (state: PromoState, ctx: ConditionContext) => {
    const nowDate = dayjs(ctx.currentDate);

    const lastTimeCall = getLastTimeCall(state, ctx.promoSlug || ctx.promoType);

    if (!lastTimeCall) {
        return Infinity;
    }
    const timeFromLastCall = dayjs.duration(nowDate.diff(dayjs(lastTimeCall)));

    return timeFromLastCall.asMilliseconds();
};

export const PromoInCurrentDay: ConditionHelper = (date: Date) => {
    return () => date.toDateString() === new Date().toDateString();
};

export const ShowOnceForPeriod: ConditionHelper = (
    ...params: Parameters<typeof dayjs.duration>
) => {
    return (state, ctx) => {
        const targetInterval = dayjs.duration(...params);

        return getTimeFromLastCallInMs(state, ctx) > targetInterval.asMilliseconds();
    };
};

export const ShowOnceForSession: ConditionHelper = () => {
    return (state, ctx) => {
        const targetInterval = dayjs.duration(performance.now());

        return getTimeFromLastCallInMs(state, ctx) > targetInterval.asMilliseconds();
    };
};

export const LimitFrequency: ConditionHelper = ({
    slugs,
    interval,
}: {
    slugs: string[];
    interval: DurationParam;
}) => {
    return (state: PromoState, ctx: ConditionContext) => {
        // @ts-ignore
        const targetInterval = dayjs.duration(interval);

        for (const slug of slugs) {
            if (
                getTimeFromLastCallInMs(state, {...ctx, promoSlug: slug}) <
                targetInterval.asMilliseconds()
            ) {
                return false;
            }
        }

        return true;
    };
};

export const MatchUrl: ConditionHelper = (regExp: string) => () => {
    const currentUrl = window.location.href;
    return new RegExp(regExp).test(currentUrl);
};
