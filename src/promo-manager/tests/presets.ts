import {PromoInCurrentDay, ShowOncePerMonths} from '../core/conditions';
import type {TypePreset} from '../core/types';

export const pollPreset: TypePreset = {
    slug: 'poll',
    conditions: [],
    promos: [
        {
            slug: 'boardPoll',
            conditions: [],
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

export const pollPreset2: TypePreset = {
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

export const pollWithConditions: TypePreset = {
    slug: 'ask',
    conditions: [ShowOncePerMonths(1)],
    promos: [
        {
            slug: 'every2Months',
            conditions: [ShowOncePerMonths(2)],
        },
        {
            slug: 'free',
            conditions: [],
        },
        {
            slug: 'every2Months2',
            conditions: [ShowOncePerMonths(2)],
        },
    ],
};
