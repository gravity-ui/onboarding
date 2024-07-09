import {LimitFrequency} from './condition-helpers';

describe('LimitFrequency', function () {
    const currentDate = new Date('07-15-2024').valueOf();

    it('empty state -> true ', function () {
        const helper = LimitFrequency({
            slugs: ['somePromo1', 'somePromo2'],
            interval: {weeks: 1},
        });

        const state = {
            base: {
                activePromo: null,
                activeQueue: [],
            },
            progress: {
                finishedPromos: [],
                progressInfoByType: {},
                progressInfoByPromo: {},
            },
        };

        expect(helper(state, {currentDate})).toBe(true);
    });

    describe('pick by slug', function () {
        it('not enough time for next activity', function () {
            const helper = LimitFrequency({
                slugs: ['somePromo1', 'somePromo2'],
                interval: {weeks: 1},
            });

            const state = {
                base: {
                    activePromo: null,
                    activeQueue: [],
                },
                progress: {
                    finishedPromos: ['somePromo1'],
                    progressInfoByType: {},
                    progressInfoByPromo: {
                        somePromo1: {
                            lastCallTime: new Date('07-15-2024').valueOf(),
                        },
                    },
                },
            };

            expect(helper(state, {currentDate})).toBe(false);
        });

        it('enough time for next activity', function () {
            const helper = LimitFrequency({
                slugs: ['somePromo1', 'somePromo2'],
                interval: {weeks: 1},
            });

            const state = {
                base: {
                    activePromo: null,
                    activeQueue: [],
                },
                progress: {
                    finishedPromos: ['somePromo1'],
                    progressInfoByType: {},
                    progressInfoByPromo: {
                        somePromo1: {
                            lastCallTime: new Date('07-01-2024').valueOf(),
                        },
                    },
                },
            };

            expect(helper(state, {currentDate})).toBe(true);
        });
    });

    describe('pick by type', function () {
        it('not enough time for next activity', function () {
            const helper = LimitFrequency({
                slugs: ['someType1', 'someType2'],
                interval: {weeks: 1},
            });

            const state = {
                base: {
                    activePromo: null,
                    activeQueue: [],
                },
                progress: {
                    finishedPromos: ['somePromo1'],
                    progressInfoByType: {
                        someType1: {
                            lastCallTime: new Date('07-15-2024').valueOf(),
                        },
                    },
                    progressInfoByPromo: {},
                },
            };

            expect(helper(state, {currentDate})).toBe(false);
        });

        it('enough time for next activity', function () {
            const helper = LimitFrequency({
                slugs: ['someType1', 'someType2'],
                interval: {weeks: 1},
            });

            const state = {
                base: {
                    activePromo: null,
                    activeQueue: [],
                },
                progress: {
                    finishedPromos: ['somePromo1'],
                    progressInfoByType: {
                        someType1: {
                            lastCallTime: new Date('07-01-2024').valueOf(),
                        },
                    },
                    progressInfoByPromo: {},
                },
            };

            expect(helper(state, {currentDate})).toBe(true);
        });
    });

    it('not enough time for next activity. Type and slug', function () {
        const helper = LimitFrequency({
            slugs: ['someType1', 'somePromo1'],
            interval: {weeks: 1},
        });

        const state = {
            base: {
                activePromo: null,
                activeQueue: [],
            },
            progress: {
                finishedPromos: ['somePromo1'],
                progressInfoByType: {
                    someType1: {
                        lastCallTime: new Date('07-15-2024').valueOf(),
                    },
                },
                progressInfoByPromo: {},
            },
        };

        expect(helper(state, {currentDate})).toBe(false);
    });
});
