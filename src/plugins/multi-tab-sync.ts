import {EventsMap, OnboardingPlugin} from '../types';
import type {Controller} from '../controller';

type PluginOptions = {
    changeStateLSKey: string;
    closeHintLSKey: string;
    enableCloseHintSync: boolean;
    __unstable_enableStateSync: boolean;
};

const DEFAULT_PLUGIN_OPTIONS = {
    changeStateLSKey: 'onboarding.plugin-sync.changeState',
    closeHintLSKey: 'onboarding.plugin-sync.closeHint',
    enableCloseHintSync: true,
    __unstable_enableStateSync: false,
};
export class MultiTabSyncPlugin implements OnboardingPlugin {
    static isQuotaExceededError(err: unknown): boolean {
        return (
            err instanceof DOMException &&
            // everything except Firefox
            (err.code === 22 ||
                // Firefox
                err.code === 1014 ||
                // test name field too, because code might not be present
                // everything except Firefox
                err.name === 'QuotaExceededError' ||
                // Firefox
                err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
        );
    }

    name = 'multiTabSyncPlugin';
    onboardingInstance?: Controller<any, any, any>;
    options: PluginOptions;

    isQuotaExceeded = false;

    constructor(userOptions: Partial<PluginOptions> = {}) {
        this.options = {
            ...DEFAULT_PLUGIN_OPTIONS,
            ...userOptions,
        };
    }

    apply: OnboardingPlugin['apply'] = ({onboarding}) => {
        this.onboardingInstance = onboarding;

        window.addEventListener('storage', this.handleLSEvent);

        if (this.options.__unstable_enableStateSync) {
            onboarding.events.subscribe('stateChange', () => this.changeState(onboarding.state));
        }

        if (this.options.enableCloseHintSync) {
            onboarding.events.subscribe('closeHint', this.closeHint);
        }
    };

    handleLSEvent = (event: StorageEvent) => {
        if (!this.onboardingInstance) {
            return;
        }

        const isChangeStateEvent = event.key === this.options.changeStateLSKey && event.newValue;
        if (this.options.__unstable_enableStateSync && isChangeStateEvent) {
            this.onboardingInstance.state = JSON.parse(event.newValue);
            this.onboardingInstance.emitStateChange();
        }

        const isCloseHintEvent = event.key === this.options.closeHintLSKey && event.newValue;
        if (this.options.enableCloseHintSync && isCloseHintEvent) {
            this.onboardingInstance.closeHintByUser(event.newValue);
        }
    };

    closeHint = ({hint}: EventsMap['closeHint']) => {
        window.localStorage.setItem(this.options.closeHintLSKey, hint.step.slug);
    };

    changeState = (newValue: any) => {
        if (this.isQuotaExceeded) {
            return;
        }
        try {
            localStorage.setItem(this.options.changeStateLSKey, JSON.stringify(newValue));
        } catch (e) {
            if (MultiTabSyncPlugin.isQuotaExceededError(e)) {
                this.isQuotaExceeded = true;
            }
        }
    };
}
