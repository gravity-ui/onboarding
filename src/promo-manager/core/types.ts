import {LoggerOptions} from '../../logger';
import {Controller as OnboardingController} from '../../controller';
import {Controller} from './controller';

export type PromoStatus = 'forbidden' | 'canRun' | 'active' | 'finished' | 'pending';
export type Priority = 'high';
export type PromoManagerStatus = 'idle' | 'initialized';

export type PromoMeta = Record<string, any>;

export type PromoSlug = string;
export type PromoGroupSlug = string;

export type Trigger = {on: string; timeout?: number};
export type Promo<T = PromoMeta> = {
    slug: PromoSlug;
    conditions?: Condition[];
    priority?: Priority;
    meta?: T;
    trigger?: Trigger;
};

export type PromoGroup<Config = PromoMeta> = {
    slug: PromoGroupSlug;
    conditions?: Condition[];
    promos: Promo<Config>[];
};

export type InitPromoManagerOptions = {
    initType: 'timeout';
    timeout: number;
};

export type OnboardingIntegrationOptions = {
    getInstance: () => OnboardingController<any, any, any>;

    groupSlug: string;
};

export type PromoManagerPlugin = {
    name: string;
    apply: (pluginInterface: {promoManager: Controller}) => void;
};

export type PromoOptions = {
    config: {
        promoGroups: PromoGroup[];
        constraints?: Condition[];
        init?: InitPromoManagerOptions;
    };
    conditionHelpers?: Record<string, ConditionHelper>;
    onboarding?: OnboardingIntegrationOptions;
    progressState: Partial<PromoProgressState> | undefined;
    getProgressState: () => Promise<Partial<PromoProgressState>>;
    onSave: {
        progress: (state: PromoProgressState) => Promise<any>;
    };
    plugins?: PromoManagerPlugin[];
    debugMode?: boolean;
    logger?: LoggerOptions;
};

export type ConditionContext = {
    promoType?: PromoGroupSlug;
    promoSlug?: PromoSlug;
    currentDate: number;
    helpers?: Record<string, ConditionHelper>;
    config: PromoOptions['config'];
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
    promoBySlug: {[slug: PromoSlug]: Promo};
};

export type Nullable<T> = T | null;

export type EventsMap = {
    init: {};
};

export type EventTypes = keyof EventsMap;
