import type {ConditionParams} from './types';

const getLastTimeCall = ({type, slug, state, byType}: ConditionParams) => {
    return byType
        ? state.progress?.progressInfoByType[type]?.lastCallTime
        : state.progress?.progressInfoByPromo[slug]?.lastCallTime;
};

export const PromoInCurrentDay = (date: Date) => {
    return () => date.toDateString() === new Date().toDateString();
};

export const ShowOncePerMonths = (months: number) => {
    return (params: ConditionParams) => {
        const dateNow = new Date(params.date);

        dateNow.setMonth(dateNow.getMonth() - months);

        const lastTimeCall = getLastTimeCall(params);

        if (!lastTimeCall) {
            return true;
        }

        return dateNow.getTime() >= lastTimeCall;
    };
};
