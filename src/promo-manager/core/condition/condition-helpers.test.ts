import {LimitFrequency, MatchUrl, ShowOnceForPeriod, ShowOnceForSession} from './condition-helpers';

describe('ShowOnceForPeriod', function () {
    const currentDate = new Date('07-15-2024').valueOf();

    it('empty state -> true', function () {
        const helper = ShowOnceForPeriod({weeks: 1});

        const state = {
            base: {
                activePromo: null,
                activeQueue: [],
            },
            progress: {
                finishedPromos: [],
                progressInfoByPromoGroup: {},
                progressInfoByPromo: {},
            },
        };

        expect(helper(state, {currentDate, promoSlug: 'somePromo1'})).toBe(true);
    });

    describe('pick by promo', function () {
        it('not enough time has passed to start -> false', function () {
            const helper = ShowOnceForPeriod({weeks: 1});

            const state = {
                base: {
                    activePromo: null,
                    activeQueue: [],
                },
                progress: {
                    finishedPromos: ['somePromo1'],
                    progressInfoByPromoGroup: {},
                    progressInfoByPromo: {
                        somePromo1: {
                            lastCallTime: new Date('07-14-2024').valueOf(),
                        },
                    },
                },
            };

            expect(helper(state, {currentDate, promoSlug: 'somePromo1'})).toBe(false);
        });

        it('enough time has passed to start -> false', function () {
            const helper = ShowOnceForPeriod({weeks: 1});

            const state = {
                base: {
                    activePromo: null,
                    activeQueue: [],
                },
                progress: {
                    finishedPromos: ['somePromo1'],
                    progressInfoByPromoGroup: {},
                    progressInfoByPromo: {
                        somePromo1: {
                            lastCallTime: new Date('07-01-2024').valueOf(),
                        },
                    },
                },
            };

            expect(helper(state, {currentDate, promoSlug: 'somePromo1'})).toBe(true);
        });
    });

    describe('pick by group', function () {
        it('not enough time has passed to start -> false', function () {
            const helper = ShowOnceForPeriod({weeks: 1});

            const state = {
                base: {
                    activePromo: null,
                    activeQueue: [],
                },
                progress: {
                    finishedPromos: ['somePromo1'],
                    progressInfoByPromoGroup: {
                        promoGroup1: {
                            lastCallTime: new Date('07-14-2024').valueOf(),
                        },
                    },
                    progressInfoByPromo: {
                        somePromo1: {
                            lastCallTime: new Date('07-14-2024').valueOf(),
                        },
                    },
                },
            };

            expect(helper(state, {currentDate, promoType: 'promoGroup1'})).toBe(false);
        });

        it('enough time has passed to start -> true', function () {
            const helper = ShowOnceForPeriod({weeks: 1});

            const state = {
                base: {
                    activePromo: null,
                    activeQueue: [],
                },
                progress: {
                    finishedPromos: ['somePromo1'],
                    progressInfoByPromoGroup: {
                        promoGroup1: {
                            lastCallTime: new Date('07-01-2024').valueOf(),
                        },
                    },
                    progressInfoByPromo: {
                        somePromo1: {
                            lastCallTime: new Date('07-01-2024').valueOf(),
                        },
                    },
                },
            };

            expect(helper(state, {currentDate, promoType: 'promoGroup1'})).toBe(true);
        });
    });
});
describe('ShowOnceForSession', function () {
    const currentDate = new Date('07-15-2024').valueOf();

    it('empty state -> true ', function () {
        const helper = ShowOnceForSession();

        const state = {
            base: {
                activePromo: null,
                activeQueue: [],
            },
            progress: {
                finishedPromos: [],
                progressInfoByPromoGroup: {},
                progressInfoByPromo: {},
            },
        };

        expect(helper(state, {currentDate, promoSlug: 'somePromo'})).toBe(true);
    });

    it('has run -> false ', function () {
        const state = {
            base: {
                activePromo: null,
                activeQueue: [],
            },
            progress: {
                finishedPromos: ['somePromo1'],
                progressInfoByPromoGroup: {},
                progressInfoByPromo: {
                    somePromo1: {
                        lastCallTime: currentDate,
                    },
                },
            },
        };

        const helper = ShowOnceForSession();

        expect(helper(state, {currentDate, promoSlug: 'somePromo1'})).toBe(false);
    });
});
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
                progressInfoByPromoGroup: {},
                progressInfoByPromo: {},
            },
        };

        expect(helper(state, {currentDate})).toBe(true);
    });

    describe('pick by slug', function () {
        it('not enough time has passed -> false', function () {
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
                    progressInfoByPromoGroup: {},
                    progressInfoByPromo: {
                        somePromo1: {
                            lastCallTime: new Date('07-15-2024').valueOf(),
                        },
                    },
                },
            };

            expect(helper(state, {currentDate})).toBe(false);
        });

        it('enough time has passed to start -> true', function () {
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
                    progressInfoByPromoGroup: {},
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
        it('not enough time has passed to start -> false', function () {
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
                    progressInfoByPromoGroup: {
                        someType1: {
                            lastCallTime: new Date('07-15-2024').valueOf(),
                        },
                    },
                    progressInfoByPromo: {},
                },
            };

            expect(helper(state, {currentDate})).toBe(false);
        });

        it('enough time has passed to start -> true', function () {
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
                    progressInfoByPromoGroup: {
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

    it('not enough time has passed to start. Type and slug', function () {
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
                progressInfoByPromoGroup: {
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
    const setCurrentUrl = (url: string) => window.history.pushState({}, '', new URL(url));

    it('math host', function () {
        const helper = MatchUrl('localhost');

        setCurrentUrl('http://localhost/');

        expect(helper()).toBe(true);
    });

    it('match query', function () {
        const helper = MatchUrl('param=value');

        setCurrentUrl('http://localhost/page/?param=value');

        expect(helper()).toBe(true);
    });

    it('match query', function () {
        const helper = MatchUrl('param=value');

        setCurrentUrl('http://localhost/page/?param=value');

        expect(helper()).toBe(true);
    });

    it('match hash', function () {
        const helper = MatchUrl('#somehash');

        setCurrentUrl('http://localhost/#somehash');

        expect(helper()).toBe(true);
    });

    it('multiple calls', function () {
        const helper = MatchUrl('localhost');

        setCurrentUrl('http://localhost/#somehash');

        expect(helper()).toBe(true);
        expect(helper()).toBe(true);
    });

    it('math host with complex regex', function () {
        const helper = MatchUrl('/folder/\\w{5}/page$');

        setCurrentUrl('http://localhost/folder/12354/page');

        expect(helper()).toBe(true);
    });
});
