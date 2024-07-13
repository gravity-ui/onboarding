import {LoggerOptions} from '../../logger';

export type PromoStatus = 'forbidden' | 'canRun' | 'active' | 'finished' | 'pending';
export type Priority = 'high';
export type PromoManagerStatus = 'idle' | 'error' | 'active';

export type PromoMeta = Record<string, any>;

export type PromoSlug = string;
export type PromoGroupSlug = string;

export type Promo<T = PromoMeta> = {
    slug: PromoSlug;
    conditions?: Condition[];
    priority?: Priority;
    meta?: T;
};

export type PromoGroup<Config = PromoMeta> = {
    slug: PromoGroupSlug;
    conditions?: Condition[];
    promos: Promo<Config>[];
};

export type PromoOptions = {
    config: {
        promoGroups: PromoGroup[];
        constraints?: Condition[];
    };
    conditionHelpers?: Record<string, ConditionHelper>;
    progressState: Partial<PromoProgressState> | undefined;
    getProgressState: () => Promise<Partial<PromoProgressState>>;
    onSave: {
        progress: (state: PromoProgressState) => Promise<any>;
    };
    debugMode?: boolean;
    logger?: LoggerOptions;
};

export type ConditionContext = {
    promoType?: PromoGroupSlug;
    promoSlug?: PromoSlug;
    currentDate: number;
    helpers?: Record<string, ConditionHelper>;
};
export type ConditionParams = [PromoState, ConditionContext];

export type ConditionFn = (...params: ConditionParams) => boolean;
export type ConditionHelper = (...args: any[]) => ConditionFn;
export type ConditionObject = {
    helper: string;
    args?: Array<string | number | object>;
};

export type Condition = ConditionFn | ConditionObject;

export type Conditions = {
    typeConditions: {
        [slug: PromoGroupSlug]: Condition[];
    };

    promoConditions: {
        [slug: PromoSlug]: Condition[];
    };
};

export type PromoState = {
    base: PromoBaseState;
    progress?: PromoProgressState;
};

export type PromoBaseState = {
    activePromo: Nullable<string>;
    activeQueue: PromoSlug[];
};

export type PromoProgressState = {
    finishedPromos: PromoSlug[];
    progressInfoByType: ProgressInfo;
    progressInfoByPromo: ProgressInfo;
};

export type ProgressInfoConfig = {
    lastCallTime: Nullable<number>;
};

type ProgressInfo = {
    [key: PromoGroupSlug]: ProgressInfoConfig;
};

export type Helpers = {
    typeBySlug: {
        [slug: PromoSlug]: PromoGroupSlug;
    };
    prioritiesBySlug: {
        [slug: PromoSlug]: number;
    };
    metaBySlug: {[slug: PromoSlug]: PromoMeta};
};

export type Nullable<T> = T | null;
