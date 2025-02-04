import type {Controller} from '../core/controller';
import {PromoManagerPlugin} from '../core/types';
import {isQuotaExceededError} from '../../utils/isQuotaExceededError';

type PluginOptions = {
    __UNSTABLE__syncState: boolean;
    stateLSKey: string;
};

const DEFAULT_PLUGIN_OPTIONS = {
    __UNSTABLE__syncState: false,
    stateLSKey: 'promoManager.plugin-sync.state',
};

export class PromoTabSyncPlugin implements PromoManagerPlugin {
    name = 'promoTabSyncPlugin';
    promoManager?: Controller;
    options: PluginOptions;

    isQuotaExceeded = false;

    storeChangedTime: number;

    constructor(userOptions: Partial<PluginOptions> = {}) {
        this.options = {
            ...DEFAULT_PLUGIN_OPTIONS,
            ...userOptions,
        };

        this.storeChangedTime = Date.now();
    }

    apply: PromoManagerPlugin['apply'] = ({promoManager}) => {
        this.promoManager = promoManager;

        this.storeChangedTime = promoManager.dateNow();

        if (this.options.__UNSTABLE__syncState) {
            promoManager.events.subscribe('finishPromo', () => {
                this.saveStateToLS({
                    date: promoManager.dateNow(),
                    value: promoManager.state.progress,
                });

                this.storeChangedTime = promoManager.dateNow();
            });

            promoManager.events.subscribe('cancelPromo', () => {
                this.saveStateToLS({
                    date: promoManager.dateNow(),
                    value: promoManager.state.progress,
                });

                this.storeChangedTime = promoManager.dateNow();
            });

            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    const lsValue = JSON.parse(
                        localStorage.getItem(this.options.stateLSKey) ?? '{}',
                    );

                    if (lsValue && lsValue.date && lsValue.value) {
                        const isFreshData = lsValue.date > this.storeChangedTime;

                        if (isFreshData) {
                            promoManager.state.progress = lsValue.value;
                            promoManager['emitChange']();
                            promoManager['invalidateBaseState']();

                            this.storeChangedTime = lsValue.date;
                        }
                    }
                }
            });
        }
    };

    saveStateToLS = (newValue: any) => {
        if (this.isQuotaExceeded) {
            return;
        }
        try {
            localStorage.setItem(this.options.stateLSKey, JSON.stringify(newValue));
        } catch (e) {
            if (isQuotaExceededError(e)) {
                this.isQuotaExceeded = true;
            }
        }
    };
}
