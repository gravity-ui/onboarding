import {createDebounceHandler} from '../../debounce';
import {createLogger} from '../../logger';
import type {
    Conditions,
    Helpers,
    Nullable,
    PresetSlug,
    ProgressInfoConfig,
    Promo,
    PromoBaseState as BaseState,
    PromoManagerStatus,
    PromoOptions,
    PromoProgressState as ProgressState,
    PromoSlug,
    PromoState,
    PromoStatus,
    TypePreset,
} from './types';
import {ConditionHelper} from './types';
import {getConditions} from './utils/getConditions';
import {getHelpers} from './utils/getHelpers';
import {checkCondition} from './condition/condition-checker';

import * as defaultConditionHelpers from './condition/condition-helpers';

type Listener = () => void;

const defaultProgressState: ProgressState = {
    finishedPromos: [],
    progressInfoByType: {},
    progressInfoByPromo: {},
};

export class Controller {
    status: PromoManagerStatus;
    options: PromoOptions;
    state: PromoState;
    conditions: Conditions;
    conditionHelpers: Record<string, ConditionHelper>;
    helpers: Helpers;
    stateListeners: Set<Listener>;

    progressStatePromise?: Promise<Partial<ProgressState>>;

    emitChange: () => void;
    saveProgress: () => void;
    triggerPromoInNextTick: (updateProgressInfo?: boolean) => void;
    dateNow: () => number;

    logger: ReturnType<typeof createLogger>;

    constructor(options: PromoOptions) {
        this.options = options;
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

        this.logger =
            this.options.logger ??
            createLogger({
                context: 'Promo manager',
            });

        if (!options.progressState) {
            this.fetchProgressState().catch((error) => {
                this.logger.error(error);
            });
        }

        this.conditions = getConditions(options.config.presets);

        this.helpers = getHelpers(options.config.presets);

        this.conditionHelpers = {
            ...defaultConditionHelpers,
            ...this.options.conditionHelpers,
        };

        this.stateListeners = new Set();

        this.saveProgress = createDebounceHandler(async () => {
            try {
                this.assertProgressLoaded();
                await this.options.onSave.progress(this.state.progress);
            } catch (error) {
                this.logger.error(error);
            }
        }, 100);

        this.emitChange = createDebounceHandler(() => {
            this.emitListeners();
        }, 100);

        this.triggerPromoInNextTick = (updateProgressInfo?: boolean) => {
            return createDebounceHandler(() => {
                this.triggerNextPromo(updateProgressInfo);
            }, 0)();
        };

        this.dateNow = () => Date.now();

        if (options.debugMode) {
            // @ts-ignore
            window.promoManager = this;
        }
    }

    requestStart = async (slug: Nullable<PromoSlug>, updateProgressInfo = false) => {
        if (!slug) {
            return;
        }

        if (!this.state.progress) {
            await this.fetchProgressState();
        }

        if (!this.isAbleToRun(slug)) {
            return;
        }

        this.addPromoToActiveQueue(slug);

        await this.triggerPromoInNextTick(updateProgressInfo);
    };

    startPromoImmediately = (slug: PromoSlug) => {
        if (this.isAbleToRun(slug) || this.isPending(slug)) {
            this.activatePromo(slug);
        }
    };

    finishPromo = (slug: Nullable<PromoSlug>, closeActiveTimeout = 0) => {
        if (!slug) {
            return;
        }

        this.closePromoWithTimeout(slug, closeActiveTimeout);

        this.addPromoToFinished(slug);

        this.updateProgressInfo(slug);
    };

    cancelPromo = (
        slug: Nullable<PromoSlug>,
        updateProgressInfo = false,
        closeActiveTimeout = 0,
    ) => {
        if (!slug) {
            return;
        }

        this.closePromoWithTimeout(slug, closeActiveTimeout);

        if (updateProgressInfo) {
            this.updateProgressInfo(slug);
        }
    };

    cancelStart = (slug: Nullable<PromoSlug>) => {
        if (!slug) {
            return;
        }

        this.clearActive(slug);

        if (this.isPending(slug)) {
            this.removePromoFromActiveQueue(slug);
        }
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

    getFirstAvailablePromoByType = (slug: PresetSlug): Nullable<PromoSlug> => {
        const preset = Object.values(this.options.config.presets).find(
            (typePreset: TypePreset<unknown>) => typePreset.slug === slug,
        );

        if (!preset) {
            return null;
        }

        return (
            preset.promos.find(
                (promo: Promo) => this.isAbleToRun(promo.slug) || this.isPending(promo.slug),
            )?.slug ?? null
        );
    };

    getActivePromo = (presetSlug?: PresetSlug): Nullable<PromoSlug> => {
        const activePromo = this.state.base.activePromo;

        if (!presetSlug) return activePromo;

        return this.getTypeBySlug(activePromo) === presetSlug ? activePromo : null;
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

        const type = this.getTypeBySlug(slug);

        if (!type) {
            return;
        }

        const info = {
            lastCallTime: Date.now(),
        };

        this.updateProgressInfoByType(type, info);
        this.updateProgressInfoByPromo(slug, info);

        this.saveProgress();
    }

    clearProgressInfo() {
        this.state.progress = JSON.parse(JSON.stringify(defaultProgressState)) as ProgressState;

        this.emitChange();
        this.saveProgress();
    }

    checkPromoConditions = (slug: PromoSlug): boolean => {
        const type = this.getTypeBySlug(slug);

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

    getTypeBySlug = (slug: Nullable<PromoSlug>): Nullable<PresetSlug> => {
        if (!slug) {
            return null;
        }

        return this.helpers.typeBySlug[slug];
    };

    async fetchProgressState() {
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

    private clearActive = (slug: PromoSlug) => {
        if (!this.isActive(slug)) {
            return;
        }

        this.state.base.activePromo = null;
        this.emitChange();
    };

    private activatePromo = (slug: PromoSlug, updateProgressInfo = false) => {
        this.state.base.activePromo = slug;
        this.removePromoFromActiveQueue(slug);

        if (updateProgressInfo) {
            this.updateProgressInfo(slug);
        }

        this.emitChange();
    };

    private triggerNextPromo = (updateProgressInfo = false) => {
        if (this.state.base.activeQueue.length === 0 || this.state.base.activePromo !== null) {
            return;
        }

        const nextPromoSlug = this.state.base.activeQueue.find((slug) =>
            this.checkPromoConditions(slug),
        );
        const compliesWithConstraints = this.checkConstraints();

        if (!nextPromoSlug || !compliesWithConstraints) {
            return;
        }

        this.activatePromo(nextPromoSlug, updateProgressInfo);
    };

    private updateProgressInfoByType = (type: PresetSlug, info: ProgressInfoConfig) => {
        this.assertProgressLoaded();

        this.state.progress.progressInfoByType[type] = {
            ...this.state.progress.progressInfoByType[type],
            ...info,
        };
    };

    private updateProgressInfoByPromo = (slug: PromoSlug, info: ProgressInfoConfig) => {
        this.assertProgressLoaded();

        this.state.progress.progressInfoByPromo[slug] = {
            ...this.state.progress.progressInfoByPromo[slug],
            ...info,
        };
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

        this.emitChange();
    };

    private removePromoFromActiveQueue = (slug: PromoSlug) => {
        if (!this.isPending(slug)) {
            return;
        }

        this.state.base.activeQueue = this.state.base.activeQueue.filter(
            (promoSlug: PromoSlug) => promoSlug !== slug,
        );

        this.emitChange();
    };

    private addPromoToFinished = (slug: PromoSlug) => {
        this.assertProgressLoaded();

        this.state.progress.finishedPromos.push(slug);

        this.emitChange();
    };

    private emitListeners = () => {
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
        this.clearActive(slug);
        this.removePromoFromActiveQueue(slug);
        this.triggerNextPromo();
    };
}
