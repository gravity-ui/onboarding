import {EventsMap, OnboardingPlugin} from '../types';
import type {Controller} from '../controller';
export class WizardPlugin implements OnboardingPlugin {
    name = 'wizardPlugin';
    onboardingInstance?: Controller<any, any, any>;
    apply: OnboardingPlugin['apply'] = ({onboarding}) => {
        this.onboardingInstance = onboarding;

        onboarding.events.subscribe('init', this.onInit);

        onboarding.events.subscribe('wizardStateChanged', this.onWizardStateChanged);
    };

    onInit = () => {
        if (!this.onboardingInstance) {
            return;
        }

        const {wizardState} = this.onboardingInstance.state.base;

        const isWizardVisible = wizardState === 'visible' || wizardState === 'collapsed';

        if (isWizardVisible) {
            this.onboardingInstance.ensureRunning();
        }
    };

    onWizardStateChanged = async ({wizardState}: EventsMap['wizardStateChanged']) => {
        if (!this.onboardingInstance) {
            return;
        }

        const isWizardVisible = wizardState === 'visible' || wizardState === 'collapsed';
        if (isWizardVisible) {
            await this.onboardingInstance.ensureRunning();
        }

        if (wizardState === 'hidden') {
            this.onboardingInstance.state.base.enabled = false;
            this.onboardingInstance.emitStateChange();

            const presetToEraseProgress = this.onboardingInstance.state.base.activePresets.filter(
                (presetSlug) => {
                    if (!this.onboardingInstance) {
                        return false;
                    }
                    const preset = this.onboardingInstance.options.config.presets[presetSlug];
                    return preset.type === 'internal' || preset.visibility !== 'alwaysHidden';
                },
            );

            await this.onboardingInstance.resetPresetProgress(presetToEraseProgress);
        }
    };
}
