import {OnboardingPlugin} from '../types';
import type {Controller} from '../controller';

type PluginOptions = {
    changeStateLSKey: string;
    closeHintLSKey: string;
    enableCloseHintSync: boolean;
    enableStateSync: boolean;
};

const DEFAULT_PLUGIN_OPTIONS = {
    changeStateLSKey: 'onboarding.plugin-sync.changeState',
    closeHintLSKey: 'onboarding.plugin-sync.closeHint',
    enableCloseHintSync: true,
    enableStateSync: true,
};
export class MultiTabSyncPlugin implements OnboardingPlugin {
    name = 'multiTabSyncPlugin';
    onboardingInstance?: Controller<any, any, any>;
    options: PluginOptions;

    constructor(userOptions: Partial<PluginOptions> = {}) {
        this.options = {
            ...DEFAULT_PLUGIN_OPTIONS,
            ...userOptions,
        };
    }
    apply: OnboardingPlugin['apply'] = ({onboarding}) => {
        this.onboardingInstance = onboarding;

        window.addEventListener('storage', this.handleLSEvent);

        if (this.options.enableStateSync) {
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
        if (this.options.enableStateSync && isChangeStateEvent) {
            this.onboardingInstance.state = JSON.parse(event.newValue);
            this.onboardingInstance.emitStateChange();
        }

        const isCloseHintEvent = event.key === this.options.closeHintLSKey && event.newValue;
        if (this.options.enableCloseHintSync && isCloseHintEvent) {
            this.onboardingInstance.closeHintByUser(event.newValue);
        }
    };

    closeHint = ({step}: {step: string}) => {
        window.localStorage.setItem(this.options.closeHintLSKey, step);
    };

    changeState = (newValue: any) => {
        localStorage.setItem(this.options.changeStateLSKey, JSON.stringify(newValue));
    };
}