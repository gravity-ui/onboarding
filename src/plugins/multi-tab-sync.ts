import {EventsMap, OnboardingPlugin} from '../types';
import type {Controller} from '../controller';
import {isQuotaExceededError} from '../utils/isQuotaExceededError';

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
            onboarding.events.subscribe('stateChange', () =>
                this.changeState(onboarding.getPersistedState()),
            );
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
            this.onboardingInstance.applyPersistedState(JSON.parse(event.newValue));
        }

        const isCloseHintEvent = event.key === this.options.closeHintLSKey && event.newValue;
        if (this.options.enableCloseHintSync && isCloseHintEvent) {
            const {hint} = this.onboardingInstance.hintStore.state;

            if (!hint || !this.onboardingInstance.isTemporaryPreset(hint.preset)) {
                this.onboardingInstance.closeHintByUser(event.newValue);
            }
        }
    };

    closeHint = ({hint}: EventsMap['closeHint']) => {
        if (this.onboardingInstance?.isTemporaryPreset(hint.preset)) {
            return;
        }

        window.localStorage.setItem(this.options.closeHintLSKey, hint.step.slug);
    };

    changeState = (newValue: any) => {
        if (this.isQuotaExceeded) {
            return;
        }
        try {
            localStorage.setItem(this.options.changeStateLSKey, JSON.stringify(newValue));
        } catch (e) {
            if (isQuotaExceededError(e)) {
                this.isQuotaExceeded = true;
            }
        }
    };
}
