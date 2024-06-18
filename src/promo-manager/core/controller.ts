import {createDebounceHandler} from '../../debounce';
import {createLogger} from '../../logger';
import type {
    PromoBaseState as BaseState,
    Condition,
    Conditions,
    Helpers,
    Nullable,
    PresetSlug,
    ProgressInfoConfig,
    PromoProgressState as ProgressState,
    Promo,
    PromoManagerStatus,
    PromoOptions,
    PromoSlug,
    PromoState,
    PromoStatus,
    TypePreset,
} from './types';
import {getConditions} from './utils/getConditions';
import {getHelpers} from './utils/getHelpers';

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

        this.logger = createLogger({
            context: 'Promo manager',
        });

        if (!options.progressState) {
            this.fetchProgressState().catch((error) => {
                this.logger.error(error);
            });
        }

        this.conditions = getConditions(options.config.presets);
        this.helpers = getHelpers(options.config.presets);

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

        this.triggerPromoInNextTick(updateProgressInfo);
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

        if (!this.isValidPromo(slug)) {
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

        const availablePromo =
            preset.promos.find(
                (promo: Promo) => this.isAbleToRun(promo.slug) || this.isPending(promo.slug),
            )?.slug ?? null;

        return availablePromo;
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

    isValidPromo = (slug: PromoSlug): boolean => {
        const type = this.getTypeBySlug(slug);

        if (!type) {
            return false;
        }

        const conditionsByType = this.conditions.typeConditions[type] ?? [];
        const conditionsBySlug = this.conditions.promoConditions[slug] ?? [];

        return (
            this.applyConditions(type, slug, conditionsByType, true) &&
            this.applyConditions(type, slug, conditionsBySlug, false)
        );
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

        const nextPromoSlug = this.state.base.activeQueue.find((slug) => this.isValidPromo(slug));

        if (!nextPromoSlug) {
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

    private applyConditions = (
        type: PresetSlug,
        slug: PromoSlug,
        conditions: Condition[],
        byType: boolean,
    ) => {
        for (const condition of conditions) {
            const date = this.dateNow();

            const result = condition({type, slug, state: this.state, byType, date});

            if (!result) {
                return false;
            }
        }

        return true;
    };

    private addPromoToActiveQueue = (slug: PromoSlug) => {
        this.assertProgressLoaded();

        if (
            this.state.progress.finishedPromos.includes(slug) ||
            this.state.base.activeQueue.includes(slug) ||
            !this.isValidPromo(slug)
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
