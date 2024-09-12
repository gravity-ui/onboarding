import {EventsMap, OnboardingPlugin} from '../types';
import type {Controller} from '../controller';

type PluginOptions = {
    turnOnWhenShowHint: boolean;
    turnOnWhenSuggestPromoPreset: boolean;
};

const DEFAULT_PLUGIN_OPTIONS = {
    turnOnWhenShowHint: true,
    turnOnWhenSuggestPromoPreset: true,
};
export class PromoPresetsPlugin implements OnboardingPlugin {
    name = 'promoPresetPlugin';
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

        onboarding.events.subscribe('stepElementReached', this.onElementReach);

        onboarding.events.subscribe('beforeSuggestPreset', this.onSuggestPreset);

        onboarding.events.subscribe('wizardStateChanged', this.onWizardStateChanged);
    };

    onElementReach = ({stepData}: EventsMap['beforeShowHint']) => {
        if (!this.onboardingInstance) {
            return true;
        }

        const {wizardState} = this.onboardingInstance.state.base;

        const isPromoPreset = this.checkIsPromoPreset(stepData.preset);

        const isGuideVisible = wizardState === 'visible' || wizardState === 'collapsed';

        if (isPromoPreset) {
            // don't show promo if user interacts with onboarding

            if (!this.onboardingInstance.state.base.enabled && this.options.turnOnWhenShowHint) {
                this.onboardingInstance.state.base.enabled = true;
                this.onboardingInstance.emitStateChange();
            }

            return !isGuideVisible;
        }

        // don't show onboarding presets if guide hidden
        return isGuideVisible;
    };

    onSuggestPreset = ({preset: presetSlug}: EventsMap['beforeSuggestPreset']) => {
        if (!this.onboardingInstance) {
            return;
        }

        if (!this.options.turnOnWhenSuggestPromoPreset) {
            return;
        }

        if (this.checkIsPromoPreset(presetSlug)) {
            this.onboardingInstance.state.base.enabled = true;
            this.onboardingInstance.emitStateChange();
        }
    };

    onWizardStateChanged = async ({wizardState}: EventsMap['wizardStateChanged']) => {
        if (!this.onboardingInstance) {
            return;
        }

        if (wizardState === 'visible') {
            const isHintOpen = this.onboardingInstance.hintStore.state.open;
            const isPromoPreset = this.checkIsPromoPreset(
                this.onboardingInstance.hintStore.state.hint?.preset,
            );

            if (isHintOpen && isPromoPreset) {
                this.onboardingInstance.closeHint();
            }
        }
    };

    private checkIsPromoPreset = (presetSlug: string) => {
        if (!this.onboardingInstance) {
            return false;
        }

        const preset = this.onboardingInstance.options.config.presets[presetSlug];

        return preset?.type !== 'internal' && preset?.visibility === 'alwaysHidden';
    };
}
