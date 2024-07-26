import {createDebounceHandler} from '../../debounce';
import {createLogger, Logger} from '../../logger';
import type {
    Conditions,
    Helpers,
    Nullable,
    PromoGroupSlug,
    ProgressInfoConfig,
    Promo,
    PromoBaseState as BaseState,
    PromoManagerStatus,
    PromoOptions,
    PromoProgressState as ProgressState,
    PromoSlug,
    PromoState,
    PromoStatus,
    PromoGroup,
    ConditionHelper,
    InitPromoManagerOptions,
    EventsMap,
    EventTypes,
} from './types';
import {getConditions} from './utils/getConditions';
import {getHelpers} from './utils/getHelpers';
import {checkCondition} from './condition/condition-checker';

import * as defaultConditionHelpers from './condition/condition-helpers';

import {EventEmitter} from '../../event-emitter';
import {EventsMap as OnboardingEventsMap} from '../../types';

type Listener = () => void;

const defaultProgressState: ProgressState = {
    finishedPromos: [],
    progressInfoByType: {},
    progressInfoByPromo: {},
};

const defaultInitOptions: InitPromoManagerOptions = {
    initType: 'timeout',
    timeout: 0,
};

const delay = (timeout: number) =>
    new Promise<void>((resolve) => {
        setTimeout(resolve, timeout);
    });

export class Controller {
    options: PromoOptions;
    state: PromoState;
    conditions: Conditions;
    conditionHelpers: Record<string, ConditionHelper>;
    helpers: Helpers;
    stateListeners: Set<Listener>;

    events: EventEmitter<EventTypes, EventsMap, any>;

    triggersMap: Record<string, PromoSlug[]>;

    progressStatePromise?: Promise<Partial<ProgressState>>;
    initPromise: Promise<void> | undefined;
    saveProgress: () => void;
    logger: Logger;

    private status: PromoManagerStatus;

    constructor(options: PromoOptions) {
        this.options = options;
        this.options.config.init = options.config.init ?? defaultInitOptions;

        this.status = 'idle';

        this.state = JSON.parse(
            JSON.stringify({
                base: {
                    activePromo: null,
                    activeQueue: [],
                },
                progress: options.progressState
                    ? {
                          ...defaultProgressState,
                          ...options.progressState,
                      }
                    : undefined,
            }),
        ) as PromoState;

        this.logger = createLogger(
            this.options.logger ?? {
                context: 'Promo manager',
            },
        );

        if (!options.progressState) {
            this.fetchProgressState().catch((error) => {
                this.logger.error(error);
            });
        }

        this.conditionHelpers = {
            ...defaultConditionHelpers,
            ...this.options.conditionHelpers,
        };

        this.stateListeners = new Set();
        this.triggersMap = {};
        this.events = new EventEmitter<EventTypes, EventsMap, any>();

        this.conditions = getConditions(options.config.promoGroups);
        this.helpers = getHelpers(options.config.promoGroups);

        if (this.options.plugins) {
            for (const plugin of this.options.plugins) {
                plugin.apply({promoManager: this});
                this.logger.debug('Init promoManager plugin', plugin.name);
            }
        }

        if (this.options.config.init.initType === 'timeout') {
            this.initPromise = delay(this.options.config.init.timeout);
            this.ensureInit();
        }

        if (options.debugMode) {
            // @ts-ignore
            window.promoManager = this;
        }

        this.initEventMap();

        if (this.options.onboarding) {
            this.initOnboardingIntegration();
        }

        this.saveProgress = createDebounceHandler(async () => {
            try {
                this.assertProgressLoaded();
                await this.options.onSave.progress(this.state.progress);
            } catch (error) {
                this.logger.error(error);
            }
        }, 100);
    }

    ensureInit = async () => {
        if (this.status === 'initialized') {
            return;
        }

        await this.initPromise;
        this.status = 'initialized';
        this.events.emit('init', {});

        await this.triggerNextPromo();
    };

    dateNow = () => Date.now();

    requestStart = async (slug: Nullable<PromoSlug>) => {
        if (!slug) {
            return false;
        }

        if (!this.state.progress) {
            await this.fetchProgressState();
        }

        if (!this.isAbleToRun(slug)) {
            return false;
        }

        this.addPromoToActiveQueue(slug);

        await this.ensureInit();

        await this.triggerNextPromo();

        return this.state.base.activePromo === slug;
    };

    finishPromo = (slug: Nullable<PromoSlug>, closeActiveTimeout = 0) => {
        if (!slug) {
            return;
        }

        this.closePromoWithTimeout(slug, closeActiveTimeout);
        this.stateActions.addPromoToFinished(slug);
        this.stateActions.removeFromQueue(slug);

        this.updateProgressInfo(slug);

        this.triggerNextPromo();
    };

    cancelPromo = (slug: Nullable<PromoSlug>, closeActiveTimeout = 0) => {
        if (!slug) {
            return;
        }

        this.closePromoWithTimeout(slug, closeActiveTimeout);
        this.updateProgressInfo(slug);
    };

    cancelStart = (slug: Nullable<PromoSlug>) => {
        if (!slug) {
            return;
        }

        if (this.isActive(slug)) {
            this.stateActions.clearActive();
        }

        if (this.isPending(slug)) {
            this.stateActions.removeFromQueue(slug);
        }

        this.emitChange();
    };

    getPromoStatus = (slug: PromoSlug): PromoStatus => {
        if (!this.state.progress) {
            return 'forbidden';
        }

        if (this.isActive(slug)) {
            return 'active';
        }

        if (this.isFinished(slug)) {
            return 'finished';
        }

        if (this.isPending(slug)) {
            return 'pending';
        }

        if (!this.checkPromoConditions(slug)) {
            return 'forbidden';
        }

        return 'canRun';
    };

    getFirstAvailablePromoByType = (slug: PromoGroupSlug): Nullable<PromoSlug> => {
        const promoGroup = Object.values(this.options.config.promoGroups).find(
            (currentPromoGroup: PromoGroup<unknown>) => currentPromoGroup.slug === slug,
        );

        if (!promoGroup) {
            return null;
        }

        return (
            promoGroup.promos.find(
                (promo: Promo) => this.isAbleToRun(promo.slug) || this.isPending(promo.slug),
            )?.slug ?? null
        );
    };

    getActivePromo = (promoType?: PromoGroupSlug): Nullable<PromoSlug> => {
        const activePromo = this.state.base.activePromo;

        if (!promoType) return activePromo;

        return this.getGroupBySlug(activePromo) === promoType ? activePromo : null;
    };

    subscribe = (listener: Listener) => {
        this.stateListeners.add(listener);

        return () => {
            this.stateListeners.delete(listener);
        };
    };

    updateProgressInfo(slug: Nullable<PromoSlug>) {
        if (!slug) {
            return;
        }

        this.assertProgressLoaded();

        const type = this.getGroupBySlug(slug);

        if (!type) {
            return;
        }

        const info = {
            lastCallTime: Date.now(),
        };

        this.stateActions.updateProgressInfoByType(type, info);
        this.stateActions.updateProgressInfoByPromo(slug, info);

        this.emitChange();
        this.saveProgress();
    }

    clearProgressInfo() {
        this.state.progress = JSON.parse(JSON.stringify(defaultProgressState)) as ProgressState;

        this.emitChange();
        this.saveProgress();
    }

    checkPromoConditions = (slug: PromoSlug): boolean => {
        if (!this.checkConstraints()) {
            return false;
        }

        const type = this.getGroupBySlug(slug);

        if (!type) {
            return false;
        }

        const conditionsForType = this.conditions.typeConditions[type] ?? [];
        const conditionsForSlug = this.conditions.promoConditions[slug] ?? [];

        const resultForType = checkCondition(
            this.state,
            {promoType: type, currentDate: this.dateNow()},
            conditionsForType,
            this.logger,
        );

        const resultForSlug = checkCondition(
            this.state,
            {
                promoType: type,
                promoSlug: slug,
                currentDate: this.dateNow(),
                helpers: this.conditionHelpers,
            },
            conditionsForSlug,
            this.logger,
        );

        return resultForType && resultForSlug;
    };

    getPromoMeta = (slug: Nullable<PromoSlug>) => {
        if (!slug) {
            return {};
        }

        return this.helpers.metaBySlug[slug] || {};
    };

    getGroupBySlug = (slug: Nullable<PromoSlug>): Nullable<PromoGroupSlug> => {
        if (!slug) {
            return null;
        }

        return this.helpers.typeBySlug[slug];
    };

    sendEvent = async (eventName: string) => {
        if (!this.triggersMap[eventName]) {
            return;
        }

        for (const promoSlug of this.triggersMap[eventName]) {
            const promo = this.helpers.promoBySlug[promoSlug];

            const timeout = promo.trigger?.timeout;
            if (timeout) {
                (async () => {
                    await delay(timeout);
                    await this.requestStart(promoSlug);
                })();
            } else {
                await this.requestStart(promoSlug);
            }
        }
    };

    private async fetchProgressState() {
        if (!this.progressStatePromise) {
            this.progressStatePromise = this.options.getProgressState();
        }

        try {
            const newProgressState = await this.progressStatePromise;

            this.state.progress = JSON.parse(
                JSON.stringify({
                    ...defaultProgressState,
                    ...newProgressState,
                }),
            ) as ProgressState;
        } catch {
            throw new Error('Progress data loading error');
        }
    }

    private initEventMap = () => {
        for (const group of this.options.config.promoGroups) {
            for (const promo of group.promos) {
                if (promo.trigger) {
                    const triggerEvent = promo.trigger.on;

                    if (!this.triggersMap[triggerEvent]) {
                        this.triggersMap[triggerEvent] = [];
                    }
                    this.triggersMap[triggerEvent].push(promo.slug);
                }
            }
        }
    };

    private initOnboardingIntegration = async () => {
        if (!this.options.onboarding) {
            return;
        }

        const {getInstance, groupSlug} = this.options.onboarding;

        const promoGroupToIntegrate = this.options.config.promoGroups.find(
            (group) => group.slug === groupSlug,
        );

        if (!promoGroupToIntegrate) {
            this.logger.error("Can't find group for onboarding integration", promoGroupToIntegrate);
            return;
        }

        const instance = getInstance();

        const promoPresetSet = new Set();
        for (const [presetKey, preset] of Object.entries(instance.options.config.presets)) {
            const shouldInjectPreset =
                preset?.type !== 'internal' && preset?.visibility === 'alwaysHidden';

            if (shouldInjectPreset) {
                promoPresetSet.add(presetKey);
                const hasPromo = promoGroupToIntegrate.promos.some(
                    (promo) => promo.slug === presetKey,
                );

                if (!hasPromo) {
                    promoGroupToIntegrate.promos.push({
                        slug: presetKey,
                        conditions: [],
                    });
                }
            }
        }

        this.conditions = getConditions(this.options.config.promoGroups);
        this.helpers = getHelpers(this.options.config.promoGroups);

        instance.events.subscribe(
            'beforeShowHint',
            async ({stepData}: OnboardingEventsMap['beforeShowHint']) => {
                return this.requestStart(stepData.preset);
            },
        );

        instance.events.subscribe(
            'finishPreset',
            async ({preset}: OnboardingEventsMap['finishPreset']) => {
                if (promoPresetSet.has(preset)) {
                    this.finishPromo(preset);
                }
            },
        );

        instance.events.subscribe('closeHint', async ({hint}: OnboardingEventsMap['closeHint']) => {
            if (promoPresetSet.has(hint.preset)) {
                this.cancelStart(hint.preset);
            }
        });
    };

    private checkConstraints() {
        if (!this.options.config.constraints) {
            return true;
        }

        return checkCondition(
            this.state,
            {currentDate: this.dateNow(), helpers: this.conditionHelpers},
            this.options.config.constraints,
            this.logger,
        );
    }

    private assertProgressLoaded(): asserts this is this & {
        state: {base: BaseState; progress: ProgressState};
    } {
        if (!this.state.progress) {
            throw new Error('Promo manager progress not loaded');
        }
    }

    private isAbleToRun = (slug: PromoSlug) => {
        return this.getPromoStatus(slug) === 'canRun';
    };

    private isActive = (slug: PromoSlug) => {
        return this.state.base.activePromo === slug;
    };

    private isFinished = (slug: PromoSlug) => {
        this.assertProgressLoaded();

        return this.state.progress.finishedPromos.includes(slug);
    };

    private isPending = (slug: PromoSlug) => {
        return this.state.base.activeQueue.includes(slug);
    };

    private activatePromo = (slug: PromoSlug) => {
        this.stateActions.setActivePromo(slug);
        this.stateActions.removeFromQueue(slug);

        this.updateProgressInfo(slug);
    };

    private triggerNextPromo = () => {
        if (this.state.base.activeQueue.length === 0 || this.state.base.activePromo !== null) {
            return;
        }

        const nextPromoSlug = this.state.base.activeQueue.find((slug) =>
            this.checkPromoConditions(slug),
        );

        if (!nextPromoSlug) {
            return;
        }

        this.activatePromo(nextPromoSlug);
    };

    private addPromoToActiveQueue = (slug: PromoSlug) => {
        this.assertProgressLoaded();

        if (
            this.state.progress.finishedPromos.includes(slug) ||
            this.state.base.activeQueue.includes(slug) ||
            !this.checkPromoConditions(slug)
        ) {
            return;
        }

        this.state.base.activeQueue.push(slug);
        this.state.base.activeQueue.sort(
            (a, b) =>
                (this.helpers.prioritiesBySlug[a] ?? 0) - (this.helpers.prioritiesBySlug[b] ?? 0),
        );
    };

    private emitChange = () => {
        this.state = JSON.parse(JSON.stringify(this.state)) as PromoState;

        for (const listener of this.stateListeners) {
            listener();
        }
    };

    private closePromoWithTimeout = (slug: PromoSlug, timeout = 0) => {
        if (timeout) {
            setTimeout(() => {
                this.closePromo(slug);
            }, timeout);
        } else {
            this.closePromo(slug);
        }
    };

    private closePromo = (slug: PromoSlug) => {
        if (!this.isActive(slug)) {
            return;
        }

        this.stateActions.clearActive();
        this.stateActions.removeFromQueue(slug);
        this.triggerNextPromo();
    };

    // eslint-disable-next-line @typescript-eslint/member-ordering
    stateActions = {
        setActivePromo: (slug: string) => {
            this.state.base.activePromo = slug;
        },
        clearActive: () => {
            this.state.base.activePromo = null;
        },
        removeFromQueue: (slug: PromoSlug) => {
            this.state.base.activeQueue = this.state.base.activeQueue.filter(
                (promoSlug: PromoSlug) => promoSlug !== slug,
            );
        },
        addPromoToFinished: (slug: PromoSlug) => {
            this.assertProgressLoaded();

            this.state.progress.finishedPromos.push(slug);
        },
        updateProgressInfoByType: (type: PromoGroupSlug, info: ProgressInfoConfig) => {
            this.assertProgressLoaded();

            this.state.progress.progressInfoByType[type] = {
                ...this.state.progress.progressInfoByType[type],
                ...info,
            };
        },
        updateProgressInfoByPromo: (slug: PromoSlug, info: ProgressInfoConfig) => {
            this.assertProgressLoaded();

            this.state.progress.progressInfoByPromo[slug] = {
                ...this.state.progress.progressInfoByPromo[slug],
                ...info,
            };
        },
    };
}
