import {EventsMap, OnboardingPlugin} from '../types';
import type {Controller} from '../controller';
export class WizardPlugin implements OnboardingPlugin {
    name = 'wizardPlugin';
    onboardingInstance?: Controller<any, any, any>;
    apply: OnboardingPlugin['apply'] = ({onboarding}) => {
        this.onboardingInstance = onboarding;

        onboarding.events.subscribe('init', this.onInit);
        onboarding.events.subscribe('wizardStateChanged', this.onWizardStateChanged);
        onboarding.events.subscribe('beforeRunPreset', this.onRunPreset);
        onboarding.events.subscribe('finishPreset', this.onFinishPreset);
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

        if (wizardState === 'visible' || wizardState === 'collapsed') {
            this.onboardingInstance.state.base.enabled = true;
            this.onboardingInstance.emitStateChange();

            await this.onboardingInstance.ensureRunning();
            this.onboardingInstance.checkReachedHints();
        }

        if (wizardState === 'hidden') {
            this.onboardingInstance.state.base.enabled = false;
            this.onboardingInstance.emitStateChange();

            this.onboardingInstance.closeHint();
            await this.eraseCommonPresetsProgress();
        }
    };

    onRunPreset = async ({preset}: EventsMap['runPreset']) => {
        if (!this.onboardingInstance) {
            return;
        }

        this.onboardingInstance?.closeHintByUser();

        const currentPreset = this.onboardingInstance?.options.config.presets[preset];
        const presetVisibility =
            'visibility' in currentPreset ? currentPreset.visibility : undefined;

        if (presetVisibility !== 'alwaysHidden') {
            await this.eraseCommonPresetsProgress([preset]);
        }
    };

    onFinishPreset = ({preset}: EventsMap['finishPreset']) => {
        if (!this.onboardingInstance) {
            return;
        }

        const presets = this.onboardingInstance?.options.config.presets;
        const currentPreset = presets[preset];

        const presetVisibility =
            'visibility' in currentPreset ? currentPreset.visibility : undefined;

        if (presetVisibility !== 'alwaysHidden') {
            this.onboardingInstance.setWizardState('visible');
        }
    };

    private eraseCommonPresetsProgress = async (extraPresetsToReset: string[] = []) => {
        if (!this.onboardingInstance) {
            return;
        }

        const presetToEraseProgress = this.onboardingInstance.state.base.activePresets.filter(
            (presetSlug) => {
                if (!this.onboardingInstance) {
                    return false;
                }
                const preset = this.onboardingInstance.options.config.presets[presetSlug];
                if (!preset) {
                    return false;
                }

                return preset.type === 'internal' || preset.visibility !== 'alwaysHidden';
            },
        );

        await this.onboardingInstance.resetPresetProgress([
            ...presetToEraseProgress,
            ...extraPresetsToReset,
        ]);
    };
}
