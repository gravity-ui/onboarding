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

        onboarding.events.subscribe('beforeShowHint', this.onHintShow);

        onboarding.events.subscribe('beforeSuggestPreset', this.onSuggestPreset);
    };

    onHintShow = ({stepData}: EventsMap['beforeShowHint']) => {
        if (!this.onboardingInstance) {
            return true;
        }

        const preset = this.onboardingInstance.options.config.presets[stepData.preset];

        const {wizardState} = this.onboardingInstance.state.base;

        const isPromoPreset = preset?.type !== 'internal' && preset?.visibility === 'alwaysHidden';

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

        const preset = this.onboardingInstance.options.config.presets[presetSlug];

        const isPromoPreset = preset?.type !== 'internal' && preset?.visibility === 'alwaysHidden';

        if (isPromoPreset) {
            this.onboardingInstance.state.base.enabled = true;
            this.onboardingInstance.emitStateChange();
        }
    };
}
