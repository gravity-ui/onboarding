import {EventsMap, OnboardingPlugin} from '../types';
import type {Controller} from '../controller';
import {isQuotaExceededError} from '../utils/isQuotaExceededError';

type PluginOptions = {
    changeStateLSKey: string;
    closeHintLSKey: string;
    skipStepLSKey: string;
    enableCloseHintSync: boolean;
    __unstable_enableStateSync: boolean;
};

const DEFAULT_PLUGIN_OPTIONS = {
    changeStateLSKey: 'onboarding.plugin-sync.changeState',
    closeHintLSKey: 'onboarding.plugin-sync.closeHint',
    skipStepLSKey: 'onboarding.plugin-sync.skipStep',
    enableCloseHintSync: true,
    __unstable_enableStateSync: false,
};
export class MultiTabSyncPlugin implements OnboardingPlugin {
    name = 'multiTabSyncPlugin';
    onboardingInstance?: Controller<any, any, any>;
    options: PluginOptions;

    isQuotaExceeded = false;

    private receivingSkips = new Map<string, Map<string, number>>();
    private legacySkipCloses = new Set<string>();

    constructor(userOptions: Partial<PluginOptions> = {}) {
        this.options = {
            ...DEFAULT_PLUGIN_OPTIONS,
            ...userOptions,
            skipStepLSKey:
                userOptions.skipStepLSKey ??
                (userOptions.closeHintLSKey
                    ? `${userOptions.closeHintLSKey}.skipStep`
                    : DEFAULT_PLUGIN_OPTIONS.skipStepLSKey),
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
            onboarding.events.subscribe('stepSkip', this.skipStep);
        }
    };

    handleLSEvent = (event: StorageEvent) => {
        if (!this.onboardingInstance) {
            return undefined;
        }

        const isChangeStateEvent = event.key === this.options.changeStateLSKey && event.newValue;
        if (this.options.__unstable_enableStateSync && isChangeStateEvent) {
            this.onboardingInstance.state = JSON.parse(event.newValue);
            this.onboardingInstance.emitStateChange();
        }

        if (this.options.enableCloseHintSync && event.key === this.options.skipStepLSKey) {
            return this.receiveSkip(event.newValue);
        }

        const isCloseHintEvent = event.key === this.options.closeHintLSKey && event.newValue;
        if (this.options.enableCloseHintSync && isCloseHintEvent) {
            if (this.legacySkipCloses.delete(event.newValue)) {
                return undefined;
            }
            this.onboardingInstance.closeHintByUser(event.newValue);
        }
        return undefined;
    };

    closeHint = ({hint, eventSource}: EventsMap['closeHint']) => {
        if (
            eventSource !== 'stepSkipped' &&
            !this.receivingSkips.get(hint.preset)?.has(hint.step.slug)
        ) {
            window.localStorage.setItem(this.options.closeHintLSKey, hint.step.slug);
        }
    };

    skipStep = ({preset, step}: EventsMap['stepSkip']) => {
        if (this.receivingSkips.get(preset)?.has(step)) {
            return;
        }
        const {hint, open} = this.onboardingInstance?.hintStore.state ?? {};
        const closeHint = Boolean(open && hint?.preset === preset && hint.step.slug === step);
        const progress = this.onboardingInstance?.state.progress;
        this.writeToLS(
            this.options.skipStepLSKey,
            JSON.stringify({
                preset,
                step,
                passedSteps: progress?.presetPassedSteps[preset] ?? [],
                skippedSteps: progress?.presetSkippedSteps?.[preset] ?? [step],
                closeHint,
                nonce: Math.random(),
            }),
        );
        if (closeHint && !this.isQuotaExceeded) {
            // Force a storage event even when the previous close used the same slug.
            try {
                window.localStorage.removeItem(this.options.closeHintLSKey);
            } catch {
                return;
            }
            this.writeToLS(this.options.closeHintLSKey, step);
        }
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

    private receiveSkip = (value: string | null) => {
        if (!value || !this.onboardingInstance) {
            return undefined;
        }
        let payload;
        try {
            payload = JSON.parse(value);
        } catch {
            return undefined;
        }
        if (typeof payload?.preset !== 'string' || typeof payload.step !== 'string') {
            return undefined;
        }
        const {preset, step} = payload;
        const skippedSteps = Array.isArray(payload.skippedSteps)
            ? payload.skippedSteps.filter((slug: unknown) => typeof slug === 'string')
            : [step];
        if (!skippedSteps.includes(step)) {
            skippedSteps.push(step);
        }
        const passedSteps = Array.isArray(payload.passedSteps)
            ? payload.passedSteps.filter((slug: unknown) => typeof slug === 'string')
            : [];
        if (payload.closeHint) {
            this.legacySkipCloses.add(step);
        }
        const receivedSteps = [...new Set<string>([...passedSteps, ...skippedSteps])];
        const receiving = this.receivingSkips.get(preset) ?? new Map<string, number>();
        receivedSteps.forEach((slug) => receiving.set(slug, (receiving.get(slug) ?? 0) + 1));
        this.receivingSkips.set(preset, receiving);
        return this.onboardingInstance
            .syncPresetProgress(preset, {passedSteps, skippedSteps})
            .catch((error: unknown) =>
                this.onboardingInstance?.logger.error('Skip sync failed', error),
            )
            .finally(() => {
                receivedSteps.forEach((slug) => {
                    const remaining = (receiving.get(slug) ?? 1) - 1;
                    if (remaining > 0) {
                        receiving.set(slug, remaining);
                    } else {
                        receiving.delete(slug);
                    }
                });
                if (receiving.size === 0) {
                    this.receivingSkips.delete(preset);
                }
            });
    };

    private writeToLS = (key: string, value: string) => {
        if (this.isQuotaExceeded) {
            return;
        }
        try {
            window.localStorage.setItem(key, value);
        } catch (error) {
            if (isQuotaExceededError(error)) {
                this.isQuotaExceeded = true;
            }
        }
    };
}
