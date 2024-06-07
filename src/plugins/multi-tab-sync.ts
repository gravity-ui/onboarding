import {OnboardingPlugin} from '../types';
import type {Controller} from '../controller';

const DEFAULT_LS_KEY = 'onboarding.plugin-sync';

type PluginOptions = {
    LSKey?: string;
};

export class MultiTabSync implements OnboardingPlugin {
    name = 'multiTabSyncPlugin';
    onboardingInstance?: Controller<any, any, any>;
    LSKey: string;

    constructor({LSKey}: PluginOptions) {
        this.LSKey = LSKey ?? DEFAULT_LS_KEY;
    }
    apply: OnboardingPlugin['apply'] = ({onboarding}) => {
        this.onboardingInstance = onboarding;

        window.addEventListener('storage', this.handleLSEvent);

        onboarding.subscribe(() => this.updateLSValue(onboarding.state));
    };

    handleLSEvent = (event: StorageEvent) => {
        if (!this.onboardingInstance) {
            return;
        }

        if (event.key === this.LSKey && event.newValue) {
            this.onboardingInstance.state = JSON.parse(event.newValue);
            this.onboardingInstance.emitStateChange();
        }
    };

    updateLSValue = (newValue: any) => {
        localStorage.setItem(this.LSKey, JSON.stringify(newValue));
    };
}
