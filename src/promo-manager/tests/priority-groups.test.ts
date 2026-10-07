import {LimitFrequency, ShowOnceForPeriod} from '../core/condition/condition-helpers';
import {Controller} from '../core/controller';
import type {PromoOptions} from '../core/types';

import {testOptions} from './options';

const currentDate = new Date('2026-10-07T12:00:00Z').valueOf();

const createController = (config: PromoOptions['config']) =>
    new Controller({
        ...testOptions,
        config,
        dateNow: () => currentDate,
    });

const requestPromos = (controller: Controller, slugs: string[]) =>
    Promise.all(slugs.map((slug) => controller.requestStart(slug)));

describe('priority groups', () => {
    it('sorts promos across message groups by descending priority group', async () => {
        const controller = createController({
            promoGroups: [
                {
                    slug: 'profiling',
                    promos: [
                        {slug: 'profilingLow', priorityGroup: 1},
                        {slug: 'profilingHigh', priorityGroup: 3},
                    ],
                },
                {
                    slug: 'csat',
                    promos: [
                        {slug: 'csatHigh', priorityGroup: 3},
                        {slug: 'csatMiddle', priorityGroup: 2},
                    ],
                },
            ],
        });

        await requestPromos(controller, [
            'profilingLow',
            'csatMiddle',
            'csatHigh',
            'profilingHigh',
        ]);

        expect(controller.state.base.activePromo).toBe('profilingHigh');
        expect(controller.state.base.activeQueue).toEqual([
            'csatHigh',
            'csatMiddle',
            'profilingLow',
        ]);
    });

    it('defaults omitted priority groups to zero and supports negative values', async () => {
        const controller = createController({
            promoGroups: [
                {
                    slug: 'messages',
                    promos: [
                        {slug: 'negative', priorityGroup: -1},
                        {slug: 'implicitZero'},
                        {slug: 'explicitZero', priorityGroup: 0},
                        {slug: 'positive', priorityGroup: 1},
                    ],
                },
            ],
        });

        await requestPromos(controller, ['negative', 'explicitZero', 'implicitZero', 'positive']);

        expect(controller.state.base.activePromo).toBe('positive');
        expect(controller.state.base.activeQueue).toEqual([
            'implicitZero',
            'explicitZero',
            'negative',
        ]);
    });

    it('preserves high-priority ordering within a group without overtaking a higher group', async () => {
        const controller = createController({
            promoGroups: [
                {
                    slug: 'messages',
                    promos: [
                        {slug: 'normal', priorityGroup: 1},
                        {slug: 'configuredFirst', priorityGroup: 1, priority: 'high'},
                        {slug: 'requestedFirst', priorityGroup: 1, priority: 'high'},
                        {slug: 'higherGroup', priorityGroup: 2},
                    ],
                },
            ],
        });

        await requestPromos(controller, [
            'normal',
            'requestedFirst',
            'configuredFirst',
            'higherGroup',
        ]);

        expect(controller.state.base.activePromo).toBe('higherGroup');
        expect(controller.state.base.activeQueue).toEqual([
            'requestedFirst',
            'configuredFirst',
            'normal',
        ]);
    });

    it.each(['finishPromo', 'cancelPromo'] as const)(
        'falls through to the next priority group when %s exhausts a shared limit',
        async (closePromo) => {
            const controller = createController({
                constraints: [LimitFrequency({slugs: ['profiling', 'csat'], interval: {days: 1}})],
                promoGroups: [
                    {
                        slug: 'fallback',
                        promos: [{slug: 'fallbackPromo', priorityGroup: 1}],
                    },
                    {
                        slug: 'profiling',
                        promos: [{slug: 'profilingPromo', priorityGroup: 2}],
                    },
                    {
                        slug: 'csat',
                        promos: [{slug: 'csatPromo', priorityGroup: 2}],
                    },
                ],
            });

            await requestPromos(controller, ['fallbackPromo', 'csatPromo', 'profilingPromo']);
            expect(controller.state.base.activePromo).toBe('profilingPromo');

            controller[closePromo]('profilingPromo');

            expect(controller.state.base.activePromo).toBe('fallbackPromo');
            expect(controller.state.base.activeQueue).toEqual(['csatPromo']);
        },
    );

    it('keeps independent message-group limits within the same priority group', async () => {
        const controller = createController({
            promoGroups: [
                {
                    slug: 'fallback',
                    promos: [{slug: 'fallbackPromo', priorityGroup: 1}],
                },
                {
                    slug: 'profiling',
                    conditions: [ShowOnceForPeriod({days: 1})],
                    promos: [
                        {slug: 'profilingFirst', priorityGroup: 2},
                        {slug: 'profilingSecond', priorityGroup: 2},
                    ],
                },
                {
                    slug: 'csat',
                    conditions: [ShowOnceForPeriod({days: 1})],
                    promos: [
                        {slug: 'csatFirst', priorityGroup: 2},
                        {slug: 'csatSecond', priorityGroup: 2},
                    ],
                },
            ],
        });

        await requestPromos(controller, [
            'fallbackPromo',
            'csatSecond',
            'csatFirst',
            'profilingSecond',
            'profilingFirst',
        ]);
        expect(controller.state.base.activePromo).toBe('profilingFirst');

        controller.finishPromo('profilingFirst');

        expect(controller.state.base.activePromo).toBe('csatFirst');

        controller.finishPromo('csatFirst');

        expect(controller.state.base.activePromo).toBe('fallbackPromo');
        expect(controller.state.base.activeQueue).toEqual(['profilingSecond', 'csatSecond']);
    });

    it('scopes a limit to one priority group within the same message group', async () => {
        const controller = createController({
            constraints: [
                LimitFrequency({slugs: ['highFirst', 'highSecond'], interval: {days: 1}}),
            ],
            promoGroups: [
                {
                    slug: 'profiling',
                    promos: [
                        {slug: 'highFirst', priorityGroup: 2},
                        {slug: 'highSecond', priorityGroup: 2},
                        {slug: 'lowGroup', priorityGroup: 1},
                    ],
                },
            ],
        });

        await requestPromos(controller, ['lowGroup', 'highSecond', 'highFirst']);
        expect(controller.state.base.activePromo).toBe('highFirst');

        controller.finishPromo('highFirst');

        expect(controller.state.base.activePromo).toBe('lowGroup');
        expect(controller.state.base.activeQueue).toEqual(['highSecond']);
    });
});
