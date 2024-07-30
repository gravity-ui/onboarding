import type {Controller} from '../core/controller';
import {PromoManagerPlugin} from '../core/types';

type PluginOptions = {
    eventName: string;
};

const DEFAULT_PLUGIN_OPTIONS = {
    eventName: 'pageOpened',
};
export class UrlEventsPlugin implements PromoManagerPlugin {
    name = 'urlEventsPlugin';
    promoManager?: Controller;
    options: PluginOptions;

    constructor(userOptions: Partial<PluginOptions> = {}) {
        this.options = {
            ...DEFAULT_PLUGIN_OPTIONS,
            ...userOptions,
        };
    }
    apply: PromoManagerPlugin['apply'] = ({promoManager}) => {
        this.promoManager = promoManager;

        if ('navigation' in window) {
            // @ts-ignore
            window.navigation.addEventListener('navigate', this.handleLocationChanged);
        } else {
            this.initUrlWatcher();
        }

        this.handleLocationChanged();
    };

    initUrlWatcher = () => {
        const self = this;

        const oldPushState = history.pushState;
        history.pushState = function pushState(data, unused, url) {
            const ret = oldPushState.apply(this, [data, unused, url]);
            self.handleLocationChanged();
            return ret;
        };

        const oldReplaceState = history.replaceState;
        history.replaceState = function replaceState(data, unused, url) {
            const ret = oldReplaceState.apply(this, [data, unused, url]);
            self.handleLocationChanged();
            return ret;
        };
    };

    handleLocationChanged = () => {
        if (!this.promoManager) {
            return;
        }

        this.promoManager.sendEvent(this.options.eventName);
    };
}
