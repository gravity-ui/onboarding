import type {PromoState} from '../types';
import {ConditionContext} from '../types';

import dayjs from 'dayjs';
import duration, {DurationUnitsObjectType} from 'dayjs/plugin/duration';
import {getLastTimeCall, getTimeFromLastCallInMs} from './condition-utils';

dayjs.extend(duration);

export type DurationParam = DurationUnitsObjectType | string;

export const PromoInCurrentDay = (date: Date) => {
    return () => date.toDateString() === new Date().toDateString();
};
export const ShowOnceForPeriod = (interval: DurationParam) => {
    return (state: PromoState, ctx: ConditionContext) => {
        const lastTimeCall = getLastTimeCall(state, ctx, ctx.promoSlug || ctx.promoGroup);
        if (!lastTimeCall) {
            return true;
        }

        // @ts-ignore
        const targetInterval = dayjs.duration(interval);
        const availableAtDate = dayjs(lastTimeCall).add(targetInterval);

        const nowDate = dayjs(ctx.currentDate);
        return availableAtDate.isBefore(nowDate);
    };
};

type SlugsParam = {slugs?: string[]};
export const ShowOnceForSession = ({slugs: slugsFromParams}: SlugsParam = {}) => {
    return (state: PromoState, ctx: ConditionContext) => {
        const targetInterval = dayjs.duration(performance.now());

        const slugFromContext = ctx.promoGroup || ctx.promoSlug;
        const slugs = slugsFromParams ?? [slugFromContext];

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

export const LimitFrequency = ({slugs, interval}: {slugs: string[]; interval: DurationParam}) => {
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

export const MatchUrl = (regExp: string) => () => {
    const currentUrl = window.location.href;
    return new RegExp(regExp).test(currentUrl);
};
