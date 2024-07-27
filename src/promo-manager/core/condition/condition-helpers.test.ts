import {LimitFrequency, MatchUrl} from './condition-helpers';

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

describe('matchUrl', function () {
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

    const setCurrentUrl = (url: string) => window.history.pushState({}, '', new URL(url));

    const currentDate = new Date('07-15-2024').valueOf();

    it('math host', function () {
        const helper = MatchUrl('localhost');

        setCurrentUrl('http://localhost/');

        expect(helper(state, {currentDate})).toBe(true);
    });

    it('match query', function () {
        const helper = MatchUrl('param=value');

        setCurrentUrl('http://localhost/page/?param=value');

        expect(helper(state, {currentDate})).toBe(true);
    });

    it('match query', function () {
        const helper = MatchUrl('param=value');

        setCurrentUrl('http://localhost/page/?param=value');

        expect(helper(state, {currentDate})).toBe(true);
    });

    it('match hash', function () {
        const helper = MatchUrl('#somehash');

        setCurrentUrl('http://localhost/#somehash');

        expect(helper(state, {currentDate})).toBe(true);
    });

    it('multiple calls', function () {
        const helper = MatchUrl('localhost');

        setCurrentUrl('http://localhost/#somehash');

        expect(helper(state, {currentDate})).toBe(true);
        expect(helper(state, {currentDate})).toBe(true);
    });

    it('math host with complex regex', function () {
        const helper = MatchUrl('/folder/\\w{5}/page$');

        setCurrentUrl('http://localhost/folder/12354/page');

        expect(helper(state, {currentDate})).toBe(true);
    });
});
