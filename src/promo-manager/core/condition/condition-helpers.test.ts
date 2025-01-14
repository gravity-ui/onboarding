import {LimitFrequency, MatchUrl, ShowOnceForPeriod, ShowOnceForSession} from './condition-helpers';
import {PromoOptions} from '../types';

const config: PromoOptions['config'] = {
    promoGroups: [
        {
            slug: 'promoGroup1',
            promos: [
                {
                    slug: 'somePromo1',
                },
            ],
        },
    ],
};
describe('ShowOnceForPeriod', function () {
    const currentDate = new Date('07-15-2024').valueOf();
    // there are bug with weeks, so use days https://github.com/iamkun/dayjs/issues/2750
    const promoPeriod = {days: 2};

    it('empty state -> true', function () {
        const helper = ShowOnceForPeriod(promoPeriod);

        const state = {
            base: {
                activePromo: null,
                activeQueue: [],
            },
            progress: {
                finishedPromos: [],
                progressInfoByPromo: {},
            },
        };

        expect(helper(state, {currentDate, promoSlug: 'somePromo1', config})).toBe(true);
    });

    it('should work for short month', () => {
        const helper = ShowOnceForPeriod({months: 2});

        const state = {
            base: {
                activePromo: null,
                activeQueue: [],
            },
            progress: {
                finishedPromos: ['somePromo1'],
                progressInfoByPromo: {
                    somePromo1: {
                        lastCallTime: new Date('01-01-2025').valueOf(),
                    },
                },
            },
        };

        expect(
            helper(state, {
                currentDate: new Date('03-02-2025').valueOf(),
                promoSlug: 'somePromo1',
                config,
            }),
        ).toBe(true);
    });

    describe('pick by promo', function () {
        it('not enough time has passed to start -> false', function () {
            const helper = ShowOnceForPeriod(promoPeriod);

            const state = {
                base: {
                    activePromo: null,
                    activeQueue: [],
                },
                progress: {
                    finishedPromos: ['somePromo1'],
                    progressInfoByPromo: {
                        somePromo1: {
                            lastCallTime: new Date('07-14-2024').valueOf(),
                        },
                    },
                },
            };

            expect(helper(state, {currentDate, promoSlug: 'somePromo1', config})).toBe(false);
        });

        it('enough time has passed to start -> true', function () {
            const helper = ShowOnceForPeriod(promoPeriod);

            const state = {
                base: {
                    activePromo: null,
                    activeQueue: [],
                },
                progress: {
                    finishedPromos: ['somePromo1'],
                    progressInfoByPromo: {
                        somePromo1: {
                            lastCallTime: new Date('07-01-2024').valueOf(),
                        },
                    },
                },
            };

            expect(helper(state, {currentDate, promoSlug: 'somePromo1', config})).toBe(true);
        });
    });

    describe('pick by group', function () {
        it('not enough time has passed to start -> false', function () {
            const helper = ShowOnceForPeriod(promoPeriod);

            const state = {
                base: {
                    activePromo: null,
                    activeQueue: [],
                },
                progress: {
                    finishedPromos: ['somePromo1'],
                    progressInfoByPromo: {
                        somePromo1: {
                            lastCallTime: new Date('07-14-2024').valueOf(),
                        },
                    },
                },
            };

            expect(helper(state, {currentDate, promoGroup: 'promoGroup1', config})).toBe(false);
        });

        it('enough time has passed to start -> true', function () {
            const helper = ShowOnceForPeriod(promoPeriod);

            const state = {
                base: {
                    activePromo: null,
                    activeQueue: [],
                },
                progress: {
                    finishedPromos: ['somePromo1'],
                    progressInfoByPromo: {
                        somePromo1: {
                            lastCallTime: new Date('07-01-2024').valueOf(),
                        },
                    },
                },
            };

            expect(helper(state, {currentDate, promoGroup: 'promoGroup1', config})).toBe(true);
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
                progressInfoByPromo: {},
            },
        };

        expect(helper(state, {currentDate, promoSlug: 'somePromo', config})).toBe(true);
    });

    it('has run -> false ', function () {
        const state = {
            base: {
                activePromo: null,
                activeQueue: [],
            },
            progress: {
                finishedPromos: ['somePromo1'],
                progressInfoByPromo: {
                    somePromo1: {
                        lastCallTime: currentDate,
                    },
                },
            },
        };

        const helper = ShowOnceForSession();

        expect(helper(state, {currentDate, promoSlug: 'somePromo1', config})).toBe(false);
    });

    it('has run, for group -> false ', function () {
        const state = {
            base: {
                activePromo: null,
                activeQueue: [],
            },
            progress: {
                finishedPromos: ['somePromo1'],
                progressInfoByPromo: {
                    somePromo1: {
                        lastCallTime: currentDate,
                    },
                },
            },
        };

        const helper = ShowOnceForSession();

        expect(helper(state, {currentDate, promoGroup: 'promoGroup1', config})).toBe(false);
    });

    describe('with slugs param', function () {
        it('for slug without runs -> true ', function () {
            const helper = ShowOnceForSession({
                slugs: ['promoWithoutRuns'],
            });

            const state = {
                base: {
                    activePromo: null,
                    activeQueue: [],
                },
                progress: {
                    finishedPromos: ['somePromo1'],
                    progressInfoByPromo: {
                        somePromo1: {
                            lastCallTime: currentDate,
                        },
                    },
                },
            };

            expect(helper(state, {currentDate, config})).toBe(true);
        });

        it('for slug with runs -> false ', function () {
            const helper = ShowOnceForSession({
                slugs: ['somePromo1'],
            });

            const state = {
                base: {
                    activePromo: null,
                    activeQueue: [],
                },
                progress: {
                    finishedPromos: ['somePromo1'],
                    progressInfoByPromo: {
                        somePromo1: {
                            lastCallTime: currentDate,
                        },
                    },
                },
            };

            expect(helper(state, {currentDate, config})).toBe(false);
        });
    });

    describe('with slugs param and context -> take slug from params', function () {
        it('for slug without runs, ctx with runs -> true ', function () {
            const helper = ShowOnceForSession({
                slugs: ['promoWithoutRuns'],
            });

            const state = {
                base: {
                    activePromo: null,
                    activeQueue: [],
                },
                progress: {
                    finishedPromos: ['somePromo1'],
                    progressInfoByPromo: {
                        somePromo1: {
                            lastCallTime: currentDate,
                        },
                    },
                },
            };

            expect(helper(state, {currentDate, config, promoSlug: 'somePromo1'})).toBe(true);
        });
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
                progressInfoByPromo: {},
            },
        };

        expect(helper(state, {currentDate, config})).toBe(true);
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
                    progressInfoByPromo: {
                        somePromo1: {
                            lastCallTime: new Date('07-15-2024').valueOf(),
                        },
                    },
                },
            };

            expect(helper(state, {currentDate, config})).toBe(false);
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
                    progressInfoByPromo: {
                        somePromo1: {
                            lastCallTime: new Date('07-01-2024').valueOf(),
                        },
                    },
                },
            };

            expect(helper(state, {currentDate, config})).toBe(true);
        });
    });

    describe('pick by promoGroup', function () {
        it('not enough time has passed to start -> false', function () {
            const helper = LimitFrequency({
                slugs: ['promoGroup1', 'promoGroup2'],
                interval: {weeks: 1},
            });

            const state = {
                base: {
                    activePromo: null,
                    activeQueue: [],
                },
                progress: {
                    finishedPromos: ['somePromo1'],
                    progressInfoByPromo: {
                        somePromo1: {
                            lastCallTime: new Date('07-15-2024').valueOf(),
                        },
                    },
                },
            };

            expect(helper(state, {currentDate, config})).toBe(false);
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
                    progressInfoByPromo: {
                        somePromo1: {
                            lastCallTime: new Date('07-01-2024').valueOf(),
                        },
                    },
                },
            };

            expect(helper(state, {currentDate, config})).toBe(true);
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
                progressInfoByPromo: {
                    somePromo1: {
                        lastCallTime: new Date('07-15-2024').valueOf(),
                    },
                },
            },
        };

        expect(helper(state, {currentDate, config})).toBe(false);
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
