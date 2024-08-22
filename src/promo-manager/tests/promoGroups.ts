import {
    PromoInCurrentDay,
    ShowFinishedOnceForPeriod,
    ShowOnceForPeriod,
    SkipFinished,
} from '../core/condition/condition-helpers';
import type {PromoGroup} from '../core/types';

export const testMetaInfo = {
    testKey: 'testValue',
};

export const pollGroup: PromoGroup = {
    slug: 'poll',
    conditions: [SkipFinished()],
    promos: [
        {
            slug: 'boardPoll',
            conditions: [],
            meta: testMetaInfo,
        },
        {
            slug: 'ganttPoll',
            conditions: [],
        },
        {
            slug: 'taskPoll',
            conditions: [],
        },
        {
            slug: 'everyDayPoll',
            conditions: [PromoInCurrentDay(new Date())],
        },
        {
            slug: 'pastDayPoll',
            conditions: [PromoInCurrentDay(new Date('2000-01-26'))],
        },
    ],
};

export const pollGroup2: PromoGroup = {
    slug: 'poll2',
    conditions: [],
    promos: [
        {
            slug: 'boardPoll2',
            conditions: [],
        },
        {
            slug: 'ganttPoll2',
            conditions: [],
        },
        {
            slug: 'taskPoll2',
            conditions: [],
        },
        {
            slug: 'hightPoll2',
            conditions: [],
            priority: 'high',
        },
    ],
};

export const pollWithConditions: PromoGroup = {
    slug: 'ask',
    conditions: [ShowOnceForPeriod({months: 1}), SkipFinished()],
    promos: [
        {
            slug: 'every2Months',
            conditions: [ShowOnceForPeriod({months: 2})],
        },
        {
            slug: 'free',
            conditions: [],
        },
        {
            slug: 'every2Months2',
            conditions: [ShowOnceForPeriod({months: 2})],
        },
    ],
};

export const pollWithFinishConditions: PromoGroup = {
    slug: 'finish',
    conditions: [],
    promos: [
        {
            slug: 'skipFinished',
            conditions: [SkipFinished()],
        },
        {
            slug: 'repeatFinished',
            conditions: [ShowFinishedOnceForPeriod({months: 2})],
        },
    ],
};

export const pollWitJsonConditions: PromoGroup = {
    slug: 'ask',
    conditions: [ShowOnceForPeriod({months: 1})],
    promos: [
        {
            slug: 'every2Months',
            conditions: [
                {
                    helper: 'ShowOncePerMonth',
                    args: [2],
                },
            ],
        },
        {
            slug: 'free',
            conditions: [],
        },
        {
            slug: 'every2Months2',
            conditions: [ShowOnceForPeriod({months: 2})],
        },
    ],
};
