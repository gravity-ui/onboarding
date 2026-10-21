import {Controller as OnboardingController} from '../../controller';
import type {InitOptions, ProgressState} from '../../types';
import {Controller} from '../core/controller';
import {testOptions} from './options';
import {getAnchorElement, getOptionsWithCombined, getOptionsWithPromo} from '../../tests/utils';
import {waitForNextTick} from './utils';

const getData = () => {
    const onboardingController = new OnboardingController(
        getOptionsWithPromo({wizardState: 'hidden'}),
    );
    const options = {
        ...testOptions,
        config: {
            promoGroups: [
                {
                    slug: 'hintPromos',
                    conditions: [],
                    promos: [],
                },
            ],
        },
        onboarding: {
            getInstance: () => onboardingController,
            groupSlug: 'hintPromos',
        },
    };

    return {
        onboardingController,
        options,
    };
};

const getMultistepData = (hooks?: InitOptions<{}, string, string>['hooks']) => {
    const onboardingOptions = getOptionsWithPromo({wizardState: 'hidden'});
    onboardingOptions.config.presets.coolNewFeature.steps.push({
        slug: 'nextCoolFeature',
        name: '',
        description: '',
    });
    const onboardingController = new OnboardingController({...onboardingOptions, hooks});
    const controller = new Controller({
        ...testOptions,
        config: {
            promoGroups: [
                {slug: 'hintPromos', promos: []},
                {slug: 'polls', promos: [{slug: 'poll'}]},
            ],
        },
        onboarding: {getInstance: () => onboardingController, groupSlug: 'hintPromos'},
    });

    return {onboardingController, controller};
};

describe('init', function () {
    it('no group -> error', async function () {
        const onboardingController = new OnboardingController(getOptionsWithPromo());

        const errorLoggerMock = vi.fn();

        const controller = new Controller({
            ...testOptions,
            config: {
                promoGroups: [],
            },
            onboarding: {
                getInstance: () => onboardingController,
                groupSlug: 'hintPromos',
            },
            logger: {
                level: 'error',
                logger: {
                    error: errorLoggerMock,
                    debug: vi.fn(),
                },
            },
        });

        await controller.ensureInit();

        expect(errorLoggerMock).toHaveBeenCalled();
    });

    it('adds promos for every "alwaysHidden" preset', async function () {
        const {options} = getData();
        const controller = new Controller(options);

        await controller.ensureInit();

        const {promos} = controller.options.config.promoGroups[0];

        expect(promos).toEqual([
            {slug: 'coolNewFeature', conditions: []},
            {slug: 'coolNewFeature2', conditions: []},
        ]);
    });

    it('not duplicate existing promos', async function () {
        const onboardingController = new OnboardingController(getOptionsWithPromo());

        const existingPromo = {
            slug: 'coolNewFeature',
            conditions: [],
            meta: {a: 12},
        };
        const controller = new Controller({
            ...testOptions,
            config: {
                promoGroups: [
                    {
                        slug: 'hintPromos',
                        promos: [existingPromo],
                    },
                ],
            },
            onboarding: {
                getInstance: () => onboardingController,
                groupSlug: 'hintPromos',
            },
        });

        await controller.ensureInit();

        const {promos} = controller.options.config.promoGroups[0];

        expect(promos[0]).toBe(existingPromo);
        expect(promos[1]).toEqual({slug: 'coolNewFeature2', conditions: []});
    });
});

describe('show hint', function () {
    it('reach element -> show hint', async function () {
        const onboardingController = new OnboardingController(
            getOptionsWithPromo({wizardState: 'hidden'}),
        );
        const options = {
            ...testOptions,
            config: {
                promoGroups: [
                    {
                        slug: 'hintPromos',
                        conditions: [],
                        promos: [],
                    },
                ],
            },
            onboarding: {
                getInstance: () => onboardingController,
                groupSlug: 'hintPromos',
            },
        };

        const controller = new Controller(options);
        await controller.ensureInit();

        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });

        expect(onboardingController.hintStore.state.open).toBe(true);
        expect(onboardingController.hintStore.state.hint?.step.slug).toBe('showCoolFeature');
    });

    it('2 reach element(race condition) -> show hint', async function () {
        const onboardingController = new OnboardingController(
            getOptionsWithPromo({wizardState: 'hidden'}),
        );
        const options = {
            ...testOptions,
            config: {
                promoGroups: [
                    {
                        slug: 'hintPromos',
                        conditions: [],
                        promos: [],
                    },
                ],
            },
            onboarding: {
                getInstance: () => onboardingController,
                groupSlug: 'hintPromos',
            },
        };

        const controller = new Controller(options);
        await controller.ensureInit();

        const promise1 = onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });
        const promise2 = onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });

        await Promise.all([promise1, promise2]);

        expect(onboardingController.hintStore.state.open).toBe(true);
        expect(onboardingController.hintStore.state.hint?.step.slug).toBe('showCoolFeature');
    });

    it('false in promo condition -> no hint, no activePromo', async function () {
        const onboardingController = new OnboardingController(
            getOptionsWithPromo({wizardState: 'hidden'}),
        );

        const controller = new Controller({
            ...testOptions,
            config: {
                promoGroups: [
                    {
                        slug: 'hintPromos',
                        conditions: [() => false],
                        promos: [],
                    },
                ],
            },
            onboarding: {
                getInstance: () => onboardingController,
                groupSlug: 'hintPromos',
            },
        });

        await controller.ensureInit();

        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });

        expect(onboardingController.hintStore.state.open).toBe(false);
        expect(controller.state.base.activePromo).toBe(null);
    });

    it('return to onboarding promo -> show hint', async function () {
        const {options, onboardingController} = getData();
        const controller = new Controller(options);

        await controller.ensureInit();

        await controller.requestStart('someOtherPromo');
        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });

        await controller.finishPromo('someOtherPromo');

        await waitForNextTick();

        expect(controller.state.base.activePromo).toBe('coolNewFeature');
        expect(onboardingController.hintStore.state.open).toBe(true);
        expect(onboardingController.hintStore.state.hint?.step.slug).toBe('showCoolFeature');
    });

    it('should allow to show common preset', async function () {
        const onboardingController = new OnboardingController(
            getOptionsWithPromo({wizardState: 'visible'}),
        );
        const options = {
            ...testOptions,
            config: {
                promoGroups: [
                    {
                        slug: 'hintPromos',
                        conditions: [],
                        promos: [],
                    },
                ],
            },
            onboarding: {
                getInstance: () => onboardingController,
                groupSlug: 'hintPromos',
            },
        };

        const controller = new Controller(options);
        await controller.ensureInit();

        await onboardingController.stepElementReached({
            stepSlug: 'openBoard',
            element: getAnchorElement(),
        });

        expect(onboardingController.hintStore.state.open).toBe(true);
        expect(onboardingController.hintStore.state.hint?.step.slug).toBe('openBoard');
    });
});

describe('promos behavior', function () {
    it.each([
        {order: 'before', nextAnchor: false},
        {order: 'after', nextAnchor: false},
        {order: 'before', nextAnchor: true},
        {order: 'after', nextAnchor: true},
    ] as const)(
        'settles an obsolete first hint with its hook $order integration and next anchor: $nextAnchor',
        async ({order, nextAnchor}) => {
            let releaseFirst!: () => void;
            let releaseSecond!: () => void;
            const firstGate = new Promise<void>((resolve) => {
                releaseFirst = resolve;
            });
            const secondGate = new Promise<void>((resolve) => {
                releaseSecond = resolve;
            });
            const hook: NonNullable<InitOptions<{}, string, string>['hooks']>['beforeShowHint'] = ({
                stepData,
            }) => (stepData.stepSlug === 'showCoolFeature' ? firstGate : secondGate);
            const {onboardingController, controller} = getMultistepData(
                order === 'before' ? {beforeShowHint: hook} : undefined,
            );
            if (order === 'after') {
                onboardingController.events.subscribe('beforeShowHint', hook);
            }
            await controller.ensureInit();
            if (nextAnchor) {
                await onboardingController.stepElementReached({
                    stepSlug: 'nextCoolFeature',
                    element: getAnchorElement(),
                });
            }
            const appearance = onboardingController.stepElementReached({
                stepSlug: 'showCoolFeature',
                element: getAnchorElement(),
            });
            await waitForNextTick();
            await onboardingController.passStep('showCoolFeature');
            await waitForNextTick();
            releaseFirst();
            await appearance;
            await waitForNextTick();
            await controller.requestStart('poll');

            expect(onboardingController.hintStore.state.open).toBe(false);
            expect(controller.getActivePromo()).toBe(nextAnchor ? 'coolNewFeature' : 'poll');
            expect(controller.state.base.activeQueue).toEqual(nextAnchor ? ['poll'] : []);
            expect(controller.state.progress?.finishedPromos).not.toContain('coolNewFeature');

            releaseSecond();
            await waitForNextTick();
            expect(controller.getActivePromo()).toBe(nextAnchor ? 'coolNewFeature' : 'poll');
            expect(onboardingController.hintStore.state.hint?.step.slug).toBe(
                nextAnchor ? 'nextCoolFeature' : undefined,
            );
        },
    );

    it('waits for the selected internal preset of a combined onboarding', async () => {
        const onboardingController = new OnboardingController(
            getOptionsWithCombined({activePresets: []}),
        );
        expect(await onboardingController.waitForNextHint('combinedPreset')).toBe('unavailable');

        await onboardingController.runPreset('combinedPreset');
        await onboardingController.stepElementReached({
            stepSlug: 'someStepInternal11',
            element: getAnchorElement(),
        });
        expect(onboardingController.hintStore.state.hint?.preset).toBe('internal1');
        expect(await onboardingController.waitForNextHint('combinedPreset')).toBe('shown');

        await onboardingController.passStep('someStepInternal11');
        await onboardingController.passStep('someStepInternal12');
        expect(await onboardingController.waitForNextHint('combinedPreset')).toBe('finished');
    });

    it('waits for an already pending hint while onboarding progress loads', async () => {
        let resolveProgress!: (progress: Partial<ProgressState>) => void;
        const pendingProgress = new Promise<Partial<ProgressState>>((resolve) => {
            resolveProgress = resolve;
        });
        const onboardingController = new OnboardingController({
            ...getOptionsWithPromo({wizardState: 'hidden'}),
            getProgressState: () => pendingProgress,
        });
        const appearance = onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });
        await waitForNextTick();

        const nextHint = onboardingController.waitForNextHint('coolNewFeature');
        resolveProgress({});

        await expect(nextHint).resolves.toBe('shown');
        await appearance;
        expect(onboardingController.hintStore.state.open).toBe(true);
        expect(onboardingController.hintStore.state.hint?.step.slug).toBe('showCoolFeature');
    });

    it('releases a failed transition while another preset owns the open hint', async () => {
        let releaseHint!: () => void;
        const pendingHint = new Promise<void>((resolve) => {
            releaseHint = resolve;
        });
        const {onboardingController, controller} = getMultistepData({
            beforeShowHint: async ({stepData}) => {
                if (stepData.stepSlug === 'nextCoolFeature') {
                    await pendingHint;
                }
            },
        });
        await controller.ensureInit();
        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });
        await onboardingController.stepElementReached({
            stepSlug: 'nextCoolFeature',
            element: getAnchorElement(),
        });
        await controller.requestStart('poll');
        await onboardingController.passStep('showCoolFeature');
        await waitForNextTick();

        await onboardingController.setWizardState('visible');
        await onboardingController.stepElementReached({
            stepSlug: 'openBoard',
            element: getAnchorElement(),
        });
        expect(onboardingController.hintStore.state.hint?.preset).toBe('createProject');
        releaseHint();
        await waitForNextTick();
        onboardingController.closeHintByUser();
        await waitForNextTick();

        expect(onboardingController.hintStore.state.open).toBe(false);
        expect(controller.getActivePromo()).toBe('poll');
        expect(controller.state.base.activeQueue).toEqual([]);
    });

    it.each([
        {event: 'stepElementReached', thirdAnchor: true},
        {event: 'beforeShowHint', thirdAnchor: true},
        {event: 'beforeShowHint', thirdAnchor: false},
    ] as const)(
        'handles progress advancing during $event with the next anchor present: $thirdAnchor',
        async ({event, thirdAnchor}) => {
            let transitioning = false;
            let releaseSecond!: () => void;
            let releaseThird!: () => void;
            const secondGate = new Promise<void>((resolve) => {
                releaseSecond = resolve;
            });
            const thirdGate = new Promise<void>((resolve) => {
                releaseThird = resolve;
            });
            const {onboardingController, controller} = getMultistepData({
                stepElementReached: async ({stepData}) => {
                    if (
                        event === 'stepElementReached' &&
                        transitioning &&
                        stepData.stepSlug === 'nextCoolFeature'
                    ) {
                        await secondGate;
                    }
                },
                beforeShowHint: async ({stepData}) => {
                    if (
                        event === 'beforeShowHint' &&
                        transitioning &&
                        stepData.stepSlug === 'nextCoolFeature'
                    ) {
                        await secondGate;
                    }
                    if (stepData.stepSlug === 'thirdStep') {
                        await thirdGate;
                    }
                },
            });
            const preset = onboardingController.options.config.presets.coolNewFeature;
            if (preset.type === 'combined') {
                throw new Error('Expected a normal preset');
            }
            preset.steps.push({slug: 'thirdStep', name: '', description: ''});
            await controller.ensureInit();
            for (const stepSlug of [
                'showCoolFeature',
                'nextCoolFeature',
                ...(thirdAnchor ? ['thirdStep'] : []),
            ]) {
                await onboardingController.stepElementReached({
                    stepSlug,
                    element: getAnchorElement(),
                });
            }
            await controller.requestStart('poll');
            transitioning = true;
            await onboardingController.passStep('showCoolFeature');
            await waitForNextTick();
            expect(controller.getActivePromo()).toBe('coolNewFeature');
            await onboardingController.passStep('nextCoolFeature');
            await waitForNextTick();
            const activeBeforeObsoleteCheckSettles = controller.getActivePromo();
            releaseSecond();
            await waitForNextTick();
            const activeWhileThirdIsLoading = controller.getActivePromo();
            const hintOpenWhileThirdIsLoading = onboardingController.hintStore.state.open;
            releaseThird();
            await waitForNextTick();
            expect(activeBeforeObsoleteCheckSettles).toBe(thirdAnchor ? 'coolNewFeature' : 'poll');
            expect(activeWhileThirdIsLoading).toBe(thirdAnchor ? 'coolNewFeature' : 'poll');
            expect(hintOpenWhileThirdIsLoading).toBe(false);
            expect(controller.getActivePromo()).toBe(thirdAnchor ? 'coolNewFeature' : 'poll');
            expect(onboardingController.hintStore.state.hint?.step.slug).toBe(
                thirdAnchor ? 'thirdStep' : undefined,
            );
        },
    );

    it.each(['immediate pass', 'pending duplicate'] as const)(
        'leaves a shown hint to its close handlers after %s',
        async (scenario) => {
            let releaseDuplicate!: () => void;
            let releaseClose!: () => void;
            const duplicateGate = new Promise<void>((resolve) => {
                releaseDuplicate = resolve;
            });
            const closeGate = new Promise<void>((resolve) => {
                releaseClose = resolve;
            });
            let attempts = 0;
            let passed: Promise<void> | undefined;
            const {onboardingController, controller} = getMultistepData({
                beforeShowHint: ({stepData}) => {
                    if (
                        stepData.stepSlug === 'showCoolFeature' &&
                        ++attempts > 1 &&
                        scenario === 'pending duplicate'
                    ) {
                        return duplicateGate;
                    }
                    return undefined;
                },
                closeHint: () => closeGate,
                hintDataChanged: ({state}, instance) => {
                    if (
                        scenario === 'immediate pass' &&
                        state.open &&
                        state.hint?.step.slug === 'showCoolFeature'
                    ) {
                        passed = instance.passStep('showCoolFeature');
                    }
                },
            });
            await controller.ensureInit();
            await onboardingController.stepElementReached({
                stepSlug: 'showCoolFeature',
                element: getAnchorElement(),
            });
            await controller.requestStart('poll');
            if (scenario === 'pending duplicate') {
                expect(attempts).toBeGreaterThan(1);
                expect(onboardingController.hintStore.state.open).toBe(true);
                await onboardingController.passStep('showCoolFeature');
            } else {
                await passed;
            }
            releaseDuplicate();
            await waitForNextTick();
            const activeBeforeCloseSettles = controller.getActivePromo();
            releaseClose();
            await waitForNextTick();

            expect(activeBeforeCloseSettles).toBe('coolNewFeature');
            expect(controller.getActivePromo()).toBe('poll');
        },
    );

    it('does not block a later close hook needed by the next hint', async () => {
        let resolveClose!: () => void;
        const closeProcessed = new Promise<void>((resolve) => {
            resolveClose = resolve;
        });
        const {onboardingController, controller} = getMultistepData({
            beforeShowHint: async ({stepData}) => {
                if (stepData.stepSlug === 'nextCoolFeature') {
                    await closeProcessed;
                }
            },
        });
        onboardingController.events.subscribe('closeHint', resolveClose);
        await controller.ensureInit();
        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });
        await onboardingController.stepElementReached({
            stepSlug: 'nextCoolFeature',
            element: getAnchorElement(),
        });
        await controller.requestStart('poll');
        await onboardingController.passStep('showCoolFeature');
        await waitForNextTick();
        expect(onboardingController.hintStore.state.hint?.step.slug).toBe('nextCoolFeature');
        expect(controller.getActivePromo()).toBe('coolNewFeature');
    });

    it('settles a transition when the next step passes on show', async () => {
        let resolveHook!: () => void;
        const pendingHook = new Promise<void>((resolve) => {
            resolveHook = resolve;
        });
        const {onboardingController, controller} = getMultistepData({
            beforeShowHint: async ({stepData}) => {
                if (stepData.stepSlug === 'nextCoolFeature') {
                    await pendingHook;
                }
            },
        });
        const preset = onboardingController.options.config.presets.coolNewFeature;
        if (preset.type === 'combined') {
            throw new Error('Expected a normal preset');
        }
        preset.steps[1].passMode = 'onShowHint';
        await controller.ensureInit();
        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });
        await onboardingController.stepElementReached({
            stepSlug: 'nextCoolFeature',
            element: getAnchorElement(),
        });
        await controller.requestStart('poll');
        await onboardingController.passStep('showCoolFeature');

        const nextHint = onboardingController.waitForNextHint('coolNewFeature');
        await waitForNextTick();
        expect(controller.getActivePromo()).toBe('coolNewFeature');
        expect(onboardingController.hintStore.state.open).toBe(false);
        resolveHook();

        await expect(nextHint).resolves.toBe('shown');
        await waitForNextTick();
        expect(onboardingController.state.progress?.finishedPresets).toContain('coolNewFeature');
        expect(controller.getActivePromo()).toBe('poll');
    });

    it.each(['cancelPromo', 'skipPromo', 'finishPromo', 'finishPreset'] as const)(
        'does not show a pending transition after %s',
        async (action) => {
            const {onboardingController, controller} = getMultistepData();
            let release!: () => void;
            const gate = new Promise<void>((resolve) => {
                release = resolve;
            });
            const preparing = vi.fn(({stepData}) =>
                stepData.stepSlug === 'nextCoolFeature' ? gate : undefined,
            );
            onboardingController.events.subscribe('beforeShowHint', preparing);
            await controller.ensureInit();
            for (const stepSlug of ['showCoolFeature', 'nextCoolFeature']) {
                await onboardingController.stepElementReached({
                    stepSlug,
                    element: getAnchorElement(),
                });
            }
            await controller.requestStart('poll');
            preparing.mockClear();
            await onboardingController.passStep('showCoolFeature');
            await waitForNextTick();
            expect(preparing).toHaveBeenCalled();
            expect(controller.getActivePromo()).toBe('coolNewFeature');

            if (action === 'finishPreset') {
                await onboardingController.finishPreset('coolNewFeature');
            } else {
                controller[action]('coolNewFeature');
            }
            expect(controller.getActivePromo()).toBe('poll');
            release();
            await waitForNextTick();

            expect(controller.getActivePromo()).toBe('poll');
            expect(onboardingController.hintStore.state.open).toBe(false);
        },
    );

    it.each(['old first', 'new first'] as const)(
        'keeps a restarted promo independent of its old hint attempt: %s',
        async (order) => {
            const {onboardingController, controller} = getMultistepData();
            let releaseOld!: () => void;
            let releaseNew!: () => void;
            const oldGate = new Promise<void>((resolve) => {
                releaseOld = resolve;
            });
            const newGate = new Promise<void>((resolve) => {
                releaseNew = resolve;
            });
            let restarted = false;
            let preparedRun = '';
            onboardingController.events.subscribe('beforeShowHint', async ({stepData}) => {
                if (stepData.stepSlug === 'nextCoolFeature') {
                    const isNew = restarted;
                    await (isNew ? newGate : oldGate);
                    preparedRun = isNew ? 'new' : 'old';
                }
            });
            const shows: string[] = [];
            onboardingController.events.subscribe('showHint', ({step}) => {
                if (step === 'nextCoolFeature') {
                    shows.push(preparedRun);
                }
            });
            await controller.ensureInit();
            for (const stepSlug of ['showCoolFeature', 'nextCoolFeature']) {
                await onboardingController.stepElementReached({
                    stepSlug,
                    element: getAnchorElement(),
                });
            }
            await onboardingController.passStep('showCoolFeature');
            await waitForNextTick();
            controller.skipPromo('coolNewFeature');
            restarted = true;
            const retry = onboardingController.stepElementReached({
                stepSlug: 'nextCoolFeature',
                element: getAnchorElement(),
            });
            await waitForNextTick();
            expect(controller.getActivePromo()).toBe('coolNewFeature');
            await controller.requestStart('poll');

            if (order === 'old first') {
                releaseOld();
                await waitForNextTick();
                expect(onboardingController.hintStore.state.open).toBe(false);
                expect(controller.getActivePromo()).toBe('coolNewFeature');
                releaseNew();
            } else {
                releaseNew();
                await retry;
                releaseOld();
            }
            await retry;
            await waitForNextTick();

            expect(shows).toEqual(['new']);
            expect(controller.getActivePromo()).toBe('coolNewFeature');
            expect(controller.state.base.activeQueue).toEqual(['poll']);
            expect(onboardingController.hintStore.state.hint?.step.slug).toBe('nextCoolFeature');
        },
    );

    it('keeps a multi-step promo active until its last step is passed', async () => {
        const {onboardingController, controller} = getMultistepData();
        await controller.ensureInit();
        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });
        await onboardingController.stepElementReached({
            stepSlug: 'nextCoolFeature',
            element: getAnchorElement(),
        });
        await controller.requestStart('poll');

        await onboardingController.passStep('showCoolFeature');
        await waitForNextTick();

        expect(controller.getActivePromo()).toBe('coolNewFeature');
        expect(controller.state.base.activeQueue).toEqual(['poll']);
        expect(onboardingController.hintStore.state.open).toBe(true);
        expect(onboardingController.hintStore.state.hint?.step.slug).toBe('nextCoolFeature');

        await onboardingController.passStep('nextCoolFeature');
        await waitForNextTick();

        expect(controller.getActivePromo()).toBe('poll');
        expect(onboardingController.hintStore.state.open).toBe(false);
        expect(controller.state.progress?.finishedPromos).toContain('coolNewFeature');
    });

    it.each(['not reached', 'disconnected', 'removed on close'] as const)(
        'releases the promo when its next anchor is %s and allows a later retry',
        async (anchorState) => {
            const {onboardingController, controller} = getMultistepData(
                anchorState === 'removed on close'
                    ? {
                          hintDataChanged: ({state}, instance) => {
                              if (!state.open) {
                                  instance.reachedElements.get('nextCoolFeature')?.remove();
                              }
                          },
                      }
                    : undefined,
            );
            await controller.ensureInit();
            await onboardingController.stepElementReached({
                stepSlug: 'showCoolFeature',
                element: getAnchorElement(),
            });
            if (anchorState !== 'not reached') {
                const element = getAnchorElement();
                await onboardingController.stepElementReached({
                    stepSlug: 'nextCoolFeature',
                    element,
                });
                if (anchorState === 'disconnected') {
                    element.remove();
                }
            }
            await controller.requestStart('poll');

            await onboardingController.passStep('showCoolFeature');
            await waitForNextTick();

            expect(controller.getActivePromo()).toBe('poll');
            expect(onboardingController.hintStore.state.open).toBe(false);
            expect(controller.state.progress?.finishedPromos).not.toContain('coolNewFeature');

            controller.finishPromo('poll');
            await onboardingController.stepElementReached({
                stepSlug: 'nextCoolFeature',
                element: getAnchorElement(),
            });

            expect(controller.getActivePromo()).toBe('coolNewFeature');
            expect(onboardingController.hintStore.state.open).toBe(true);
            expect(onboardingController.hintStore.state.hint?.step.slug).toBe('nextCoolFeature');
        },
    );

    it.each([
        {event: 'beforeShowHint', result: 'remove', order: 'before', slowClose: false},
        {event: 'beforeShowHint', result: 'reject', order: 'before', slowClose: false},
        {event: 'beforeShowHint', result: 'reject', order: 'after', slowClose: false},
        {event: 'stepElementReached', result: 'reject', order: 'before', slowClose: false},
        {event: 'beforeShowHint', result: 'reject', order: 'before', slowClose: true},
    ] as const)(
        'releases a failed transition: $event, $result, $order integration, slow close: $slowClose',
        async ({event, result, order, slowClose}) => {
            const hook: NonNullable<InitOptions<{}, string, string>['hooks']>['beforeShowHint'] = ({
                stepData,
            }) => {
                if (stepData.stepSlug === 'nextCoolFeature') {
                    if (result === 'remove') {
                        stepData.element.remove();
                    } else {
                        return false;
                    }
                }
                return true;
            };
            let resolveClose!: () => void;
            const pendingClose = new Promise<void>((resolve) => {
                resolveClose = resolve;
            });
            const {onboardingController, controller} = getMultistepData({
                ...(order === 'before' ? {[event]: hook} : {}),
                closeHint: slowClose ? () => pendingClose : undefined,
            });
            if (order === 'after') {
                onboardingController.events.subscribe(event, hook);
            }
            await controller.ensureInit();
            await onboardingController.stepElementReached({
                stepSlug: 'showCoolFeature',
                element: getAnchorElement(),
            });
            await onboardingController.stepElementReached({
                stepSlug: 'nextCoolFeature',
                element: getAnchorElement(),
            });
            await controller.requestStart('poll');

            await onboardingController.passStep('showCoolFeature');
            await waitForNextTick();

            if (slowClose) {
                expect(controller.getActivePromo()).toBe('coolNewFeature');
                resolveClose();
                await waitForNextTick();
            }
            expect(controller.getActivePromo()).toBe('poll');
            expect(onboardingController.hintStore.state.open).toBe(false);
            expect(controller.state.progress?.finishedPromos).not.toContain('coolNewFeature');
            expect(onboardingController.state.progress?.presetPassedSteps.coolNewFeature).toEqual([
                'showCoolFeature',
            ]);
            resolveClose();
            await waitForNextTick();
            expect(controller.getActivePromo()).toBe('poll');
        },
    );

    it('waits for a pending element hook when another attempt rejects the next hint', async () => {
        let transitioning = false;
        let attempts = 0;
        let allowedAttempt: object | undefined;
        let resolveHook!: () => void;
        const pendingHook = new Promise<void>((resolve) => {
            resolveHook = resolve;
        });
        const {onboardingController, controller} = getMultistepData({
            stepElementReached: async ({stepData}) => {
                if (transitioning && stepData.stepSlug === 'nextCoolFeature') {
                    attempts++;
                    if (attempts === 1) {
                        allowedAttempt = stepData;
                        await pendingHook;
                    }
                }
            },
            beforeShowHint: ({stepData}) => {
                if (transitioning && stepData.stepSlug === 'nextCoolFeature') {
                    return stepData === allowedAttempt;
                }
                return true;
            },
        });
        await controller.ensureInit();
        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });
        await onboardingController.stepElementReached({
            stepSlug: 'nextCoolFeature',
            element: getAnchorElement(),
        });
        await controller.requestStart('poll');
        await waitForNextTick();
        transitioning = true;

        await onboardingController.passStep('showCoolFeature');
        await waitForNextTick();

        expect(attempts).toBeGreaterThan(1);
        expect(controller.getActivePromo()).toBe('coolNewFeature');
        expect(onboardingController.hintStore.state.open).toBe(false);

        resolveHook();
        await waitForNextTick();

        expect(controller.getActivePromo()).toBe('coolNewFeature');
        expect(controller.state.base.activeQueue).toEqual(['poll']);
        expect(onboardingController.hintStore.state.hint?.step.slug).toBe('nextCoolFeature');
        expect(onboardingController.hintStore.state.open).toBe(true);
    });

    it('reach element -> activate promo', async function () {
        const {options, onboardingController} = getData();

        const controller = new Controller(options);

        await controller.ensureInit();

        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });

        await expect(controller.state.base.activePromo).toBe('coolNewFeature');
    });

    it('pass preset -> finish promo', async function () {
        const {options, onboardingController} = getData();

        const controller = new Controller(options);

        await controller.ensureInit();

        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });
        await onboardingController.passStep('showCoolFeature');

        expect(controller.state.base.activePromo).toBe(null);
        expect(controller.state.progress?.finishedPromos).toContain('coolNewFeature');
    });

    it('element disappears -> cancel start promo', async function () {
        const {options, onboardingController} = getData();

        const controller = new Controller(options);

        await controller.ensureInit();

        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });
        await onboardingController.stepElementDisappeared('showCoolFeature');

        expect(controller.state.base.activePromo).toBe(null);
        expect(controller.state.progress?.finishedPromos).not.toContain('coolNewFeature');
    });

    it('anchor disappears during initialization -> skip promo and allow another attempt', async function () {
        vi.useFakeTimers();
        try {
            const {options, onboardingController} = getData();
            const controller = new Controller({
                ...options,
                config: {
                    ...options.config,
                    init: {initType: 'timeout', timeout: 3000},
                },
            });
            const element = getAnchorElement();
            const appearance = onboardingController.stepElementReached({
                stepSlug: 'showCoolFeature',
                element,
            });
            await vi.advanceTimersByTimeAsync(0);
            expect(controller.state.base.activeQueue).toEqual(['coolNewFeature']);
            expect(onboardingController.hintStore.state.open).toBe(false);

            element.remove();
            onboardingController.stepElementDisappeared('showCoolFeature');
            await vi.advanceTimersByTimeAsync(3000);
            await appearance;

            expect(controller.state.base.activePromo).toBe(null);
            expect(controller.state.base.activeQueue).toEqual([]);
            expect(controller.state.progress?.finishedPromos).toEqual([]);
            expect(controller.state.progress?.progressInfoByPromo).toEqual({});
            expect(onboardingController.hintStore.state.open).toBe(false);
            expect(onboardingController.state.progress?.finishedPresets).toEqual([]);
            expect(onboardingController.state.progress?.presetPassedSteps).toEqual({});

            await onboardingController.stepElementReached({
                stepSlug: 'showCoolFeature',
                element: getAnchorElement(),
            });

            expect(controller.state.base.activePromo).toBe('coolNewFeature');
            expect(onboardingController.hintStore.state.open).toBe(true);
            expect(onboardingController.hintStore.state.hint?.step.slug).toBe('showCoolFeature');
        } finally {
            vi.useRealTimers();
        }
    });

    it('anchor replaced during initialization -> show hint on the replacement', async function () {
        vi.useFakeTimers();
        try {
            const {options, onboardingController} = getData();
            const controller = new Controller({
                ...options,
                config: {
                    ...options.config,
                    init: {initType: 'timeout', timeout: 3000},
                },
            });
            const showHint = vi.fn();
            onboardingController.events.subscribe('showHint', showHint);
            const element = getAnchorElement();
            const originalAppearance = onboardingController.stepElementReached({
                stepSlug: 'showCoolFeature',
                element,
            });
            await vi.advanceTimersByTimeAsync(0);
            expect(controller.state.base.activeQueue).toEqual(['coolNewFeature']);

            element.remove();
            onboardingController.stepElementDisappeared('showCoolFeature');
            const replacement = getAnchorElement();
            const replacementAppearance = onboardingController.stepElementReached({
                stepSlug: 'showCoolFeature',
                element: replacement,
            });
            await vi.advanceTimersByTimeAsync(0);
            expect(onboardingController.reachedElements.get('showCoolFeature')).toBe(replacement);
            expect(onboardingController.hintStore.state.open).toBe(false);

            await vi.advanceTimersByTimeAsync(3000);
            await Promise.all([originalAppearance, replacementAppearance]);

            expect(controller.state.base.activePromo).toBe('coolNewFeature');
            expect(onboardingController.hintStore.state.open).toBe(true);
            expect(onboardingController.hintStore.state.anchorRef.current).toBe(replacement);
            expect(showHint).toHaveBeenCalledOnce();
            expect(controller.state.progress?.finishedPromos).toEqual([]);
        } finally {
            vi.useRealTimers();
        }
    });

    it('cant run promo preset now -> delete from queue', async function () {
        const onboardingController = new OnboardingController(
            getOptionsWithPromo({wizardState: 'hidden'}),
        );

        const controller = new Controller({
            ...testOptions,
            config: {
                promoGroups: [
                    {
                        slug: 'somePromoGroup',
                        conditions: [],
                        promos: [{slug: 'someOtherPromo'}],
                    },
                    {
                        slug: 'hintPromos',
                        conditions: [],
                        promos: [],
                    },
                ],
            },
            onboarding: {
                getInstance: () => onboardingController,
                groupSlug: 'hintPromos',
            },
        });

        await controller.ensureInit();

        await controller.requestStart('someOtherPromo');
        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });

        expect(controller.state.base.activeQueue).not.toContain('coolNewFeature');
    });

    it('cancelled hint -> not trigger promo run', async function () {
        const onboardingController = new OnboardingController(
            getOptionsWithPromo({wizardState: 'visible'}),
        );

        const options = {
            ...testOptions,
            config: {
                promoGroups: [
                    {
                        slug: 'hintPromos',
                        conditions: [],
                        promos: [],
                    },
                ],
            },
            onboarding: {
                getInstance: () => onboardingController,
                groupSlug: 'hintPromos',
            },
            debugMode: true,
        };

        const controller = new Controller(options);
        await controller.ensureInit();

        // show promo hint with visible guide
        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });

        expect(controller.state.base.activePromo).toBe(null);
    });
});

describe('reset progress', function () {
    it('reset promoManager progress -> erase onboarding presets', async function () {
        const {options, onboardingController} = getData();
        const controller = new Controller(options);

        await controller.resetToDefaultState();

        expect(onboardingController.state.base.activePresets).toEqual(['createProject']);
        expect(onboardingController.state.base.suggestedPresets).toEqual(['createProject']);

        expect(onboardingController.state.progress).toEqual({
            finishedPresets: [],
            presetPassedSteps: {},
        });
    });

    it('reset onboarding promo preset progress -> remove promo progress', async function () {
        const {options, onboardingController} = getData();
        const controller = new Controller(options);

        await controller.ensureInit();
        await onboardingController.stepElementReached({
            stepSlug: 'showCoolFeature',
            element: getAnchorElement(),
        });
        await onboardingController.passStep('showCoolFeature');

        await onboardingController.resetPresetProgress('coolNewFeature');

        expect(controller.state.progress?.finishedPromos).toEqual([]);
        expect(controller.state.progress?.progressInfoByPromo.coolNewFeature).toBe(undefined);
    });
});
