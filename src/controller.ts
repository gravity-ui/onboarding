import type {BaseState, InitOptions, ProgressState, ReachElementParams} from './types';
import {HintStore} from './hints/hintStore';
import {createLogger} from './logger';
import {PresetStatus} from './types';

type Listener = () => void;

let instanceCounter = 0;
const defaultBaseState: BaseState = {
    availablePresets: [],
    activePresets: [],
    suggestedPresets: [],
    wizardState: 'hidden' as const,
};
const defaultProgress = {
    presetPassedSteps: {},
    finishedPresets: [],
};

export class Controller<HintParams, Presets extends string, Steps extends string> {
    static findNextUnpassedStep(presetSteps: string[], passedSteps: string[]): string | undefined {
        if (!presetSteps) {
            return undefined;
        }

        for (let i = presetSteps.length - 1; i >= 1; i--) {
            const currentStep = presetSteps[i];
            const currentStepPassed = passedSteps.includes(currentStep);

            const previousStep = presetSteps[i - 1];
            const previousStepPassed = passedSteps.includes(previousStep);

            if (!currentStepPassed && previousStepPassed) {
                return currentStep;
            }
        }

        return presetSteps[0];
    }

    options: InitOptions<HintParams, Presets, Steps>;
    state: {
        base: BaseState;
        progress?: ProgressState;
    };
    status: 'idle' | 'active';
    progressLoadingPromise: Promise<Partial<ProgressState>> | undefined;
    showedHints: Set<Steps>;
    reachedHints: Map<Steps, ReachElementParams<Presets, Steps>>;
    hintStore: HintStore<HintParams, Presets, Steps>;
    logger: ReturnType<typeof createLogger>;
    stateListeners: Set<Listener>;
    passStepListeners: Set<Listener>;

    constructor(
        options: InitOptions<HintParams, Presets, Steps>,
        hintStore?: HintStore<HintParams, Presets, Steps>,
    ) {
        this.options = options;

        this.state = {
            base: {
                ...defaultBaseState,
                ...options.baseState,
            },
        };
        this.status = 'idle';
        this.showedHints = new Set();
        this.reachedHints = new Map();

        this.hintStore = hintStore || new HintStore();
        this.stateListeners = new Set();
        this.passStepListeners = new Set();
        this.logger = createLogger(options.logger ?? {}); // переименовать в logger options

        if (this.options.debugMode) {
            // @ts-ignore
            window.gravityOnboarding = this;
            this.logger.debug('Controller available as window.gravityOnboarding', this);
        }

        this.logger.debug('Initialized');

        if (instanceCounter > 0) {
            this.logger.error(
                'Should be only one Controller instance for page. Multiple instances can cause inconsistent state and race conditions',
            );
        }
        instanceCounter++;

        if (this.options.baseState?.wizardState === 'visible') {
            this.ensureRunning();
        }
    }

    passStep = async (stepSlug: Steps) => {
        this.logger.debug('Step passed', stepSlug);

        const preset = this.findPresetWithStep(stepSlug);

        if (!preset) {
            return;
        }

        if (!this.checkIsActivePreset(preset)) {
            return;
        }

        await this.ensureRunning();

        const step = this.getStepBySlug(stepSlug);
        if (step?.passRestriction === 'afterPrevious') {
            const nextStepSlug = this.findNextStepForPreset(preset);
            if (nextStepSlug !== stepSlug) {
                this.logger.debug(
                    'Pass restriction passAvailable=afterPrevious for step',
                    stepSlug,
                );
                return;
            }
        }

        this.options.hooks?.onStepPass?.({preset, step: stepSlug});
        step?.hooks?.onStepPass?.();

        await this.savePassedStepData(preset, stepSlug, () => {
            if (step?.passMode !== 'onShowHint') {
                this.logger.debug('Close hint on step', stepSlug);
                this.closeHint();
            }
        });
    };

    setWizardState = async (state: BaseState['wizardState']) => {
        this.state.base.wizardState = state;
        await this.updateBaseState();

        if (state === 'visible') {
            this.ensureRunning();
        }
    };

    stepElementReached = async (stepData: Omit<ReachElementParams<Presets, Steps>, 'preset'>) => {
        const {stepSlug, element} = stepData;

        const preset = this.findPresetWithStep(stepSlug);

        if (!preset) {
            return;
        }

        await this.processElementAppearance({
            preset,
            stepSlug,
            element,
        });
    };

    processElementAppearance = async (stepData: ReachElementParams<Presets, Steps>) => {
        const {preset, element, stepSlug} = stepData;

        this.logger.debug('Step element reached', preset, stepSlug, element);

        this.reachedHints.set(stepSlug, stepData);

        if (!this.checkIsActivePreset(preset)) {
            this.logger.debug('Preset is not active', preset, stepSlug);
            return;
        }

        if (this.state.base.wizardState === 'hidden') {
            this.logger.debug('Wizard is not active', preset, stepSlug);
            return;
        }

        await this.ensureRunning();
        this.assertProgressLoaded();

        if (this.hintStore.state.hint?.step.slug === stepSlug && this.hintStore.state.open) {
            this.logger.debug('Updating hint anchor', preset, stepSlug);
            this.hintStore.updateHintAnchor({element, step: stepSlug});
        }

        if (this.showedHints.has(stepSlug)) {
            this.logger.debug('Hint for step was shown', preset, stepSlug);
            return;
        }

        if (this.hintStore.state.open) {
            this.logger.debug('Wait for close current hint', preset, stepSlug);
            return;
        }

        const nextStep = this.findNextStepForPreset(preset);
        if (stepSlug !== nextStep) {
            this.logger.debug(`Step ${stepSlug} not is next step(${nextStep}). Preset ${preset}`);
            return;
        }

        const step = this.getStepBySlug(stepSlug);

        if (!step) {
            this.logger.debug('Unknown step', preset, stepSlug);
            return;
        }

        if (!stepData.element.isConnected) {
            this.logger.debug('Element disappeared', stepData.element, stepSlug);
            return;
        }

        this.logger.debug(`Display hint for step ${stepSlug}`);

        this.reachedHints.delete(stepSlug);

        this.options.hooks?.onShowHint?.({preset, step: stepSlug});

        this.showedHints.add(stepSlug);
        this.options.showHint?.({preset, element, step});
        this.hintStore.showHint({preset, element, step});

        if (step.passMode === 'onShowHint') {
            await this.passStep(stepSlug);
        }
    };

    stepElementDisappeared = (stepSlug: Steps) => {
        this.logger.debug(`Step element ${stepSlug} disappeared`);

        const step = this.getStepBySlug(stepSlug);

        if (step?.closeOnElementUnmount !== false) {
            this.closeHintForStep(stepSlug);
        }
    };

    closeHint = () => {
        this.logger.debug('Close hint', this.hintStore.state.hint);
        this.hintStore.closeHint();

        this.checkReachedHints();
    };

    closeHintForStep = (stepSlug: Steps) => {
        if (stepSlug !== this.hintStore.state.hint?.step.slug) {
            this.logger.debug('Hint for step', stepSlug, 'is not current hint');
            return;
        }

        this.closeHint();
    };

    getSnapshot = () => {
        return this.state;
    };

    subscribe = (listener: Listener) => {
        this.stateListeners.add(listener);
        return () => {
            this.stateListeners.delete(listener);
        };
    };

    get userPresets() {
        const visibleConfigPresets = Object.keys(this.options.config.presets).filter(
            // @ts-ignore
            (presetSlug) => !this.options.config.presets[presetSlug].hidden,
        );

        const allUserPresetSlugs = [
            ...new Set([
                ...visibleConfigPresets,
                ...this.state.base.availablePresets,
                ...this.state.base.activePresets,
                ...(this.state.progress?.finishedPresets ?? []),
            ]),
        ];

        const userExistedPresetSlugs = this.filterExistedPresets(allUserPresetSlugs);

        return userExistedPresetSlugs.map((slug) => {
            let status: PresetStatus = 'unPassed';

            if (this.state.base.activePresets.includes(slug)) {
                status = 'inProgress';
            } else if (this.state.progress?.finishedPresets.includes(slug)) {
                status = 'finished';
            }

            return {
                slug,
                name: this.options.config.presets[slug].name,
                description: this.options.config.presets[slug].name,
                status,
            };
        });
    }

    addPreset = async (presetArg: string | string[]) => {
        const presets = this.filterExistedPresets(
            Array.isArray(presetArg) ? presetArg : [presetArg],
        );
        this.logger.debug('Add new presets', presets);

        for (const preset of presets) {
            this.options.hooks?.onAddPreset?.({preset});

            if (this.state.base.availablePresets.includes(preset)) {
                return;
            }
            this.state.base.availablePresets.push(preset);
        }

        if (presets.length > 0) {
            await this.updateBaseState();
        }
    };

    suggestPresetOnce = async (preset: string) => {
        this.logger.debug('Suggest preset', preset);

        if (this.state.base.suggestedPresets.includes(preset)) {
            this.logger.debug('Preset has already been suggested', preset);
            return;
        }

        await this.setWizardState('visible');
        await this.runPreset(preset);
    };

    runPreset = async (preset: string) => {
        this.logger.debug('Run preset', preset);
        this.ensurePresetExists(preset);

        this.options.hooks?.onRunPreset?.({preset});
        this.options.config.presets[preset]?.hooks?.onStart?.();

        if (!this.state.base.availablePresets.includes(preset)) {
            this.state.base.availablePresets.push(preset);
        }

        if (this.state.base.activePresets.includes(preset)) {
            return;
        }

        this.state.base.activePresets.push(preset);
        this.state.base.suggestedPresets.push(preset);
        await this.updateBaseState();

        this.checkReachedHints();
    };

    finishPreset = async (preset: Presets, shouldSave = true) => {
        this.logger.debug('Preset finished');

        this.options.hooks?.onFinishPreset?.({preset});
        this.options.config.presets[preset]?.hooks?.onEnd?.();

        await this.ensureRunning();
        this.assertProgressLoaded();

        this.state.base.activePresets = this.state.base.activePresets.filter(
            (presetName) => presetName !== preset,
        );

        if (!this.state.progress.finishedPresets.includes(preset)) {
            this.state.progress.finishedPresets?.push(preset);
        }

        if (shouldSave) {
            await this.updateBaseState();
            await this.updateProgress();
        }
    };

    resetPresetProgress = async (presetArg: string | string[]) => {
        await this.ensureRunning();
        this.assertProgressLoaded();

        const presets = this.filterExistedPresets(
            Array.isArray(presetArg) ? presetArg : [presetArg],
        );

        this.state.progress.finishedPresets = this.state.progress.finishedPresets.filter(
            (preset) => !presets.includes(preset as Presets),
        );

        for (const preset of presets) {
            delete this.state.progress.presetPassedSteps[preset];
        }

        this.state.base.activePresets = this.state.base.activePresets.filter(
            (preset) => !presets.includes(preset as Presets),
        );

        await this.updateBaseState();
        await this.updateProgress();
    };

    private filterExistedPresets = (presets: string[]) => {
        // @ts-ignore
        return presets.filter((slug) => Boolean(this.options.config.presets[slug])) as Presets[];
    };

    private findNextStepForPreset(preset: Presets) {
        this.assertProgressLoaded();
        const presetSteps = this.options.config.presets[preset]?.steps.map((step) => step.slug);
        const passedSteps = this.state.progress.presetPassedSteps[preset] ?? [];

        if (!presetSteps || !passedSteps) {
            this.logger.debug('Unknown preset', preset);
            return undefined;
        }

        return Controller.findNextUnpassedStep(presetSteps, passedSteps);
    }

    private findPresetWithStep(stepSlug: Steps) {
        const presets = Object.keys(this.options.config.presets).filter((presetName) => {
            return this.options.config.presets[presetName as Presets].steps.some(
                (step) => step.slug === stepSlug,
            );
        }) as Array<Presets>;

        if (presets.length > 1) {
            this.logger.error('More than 1 active preset for step', stepSlug);
        }

        return presets[0];
    }

    private async savePassedStepData(preset: Presets, step: Steps, callback?: () => void) {
        this.logger.debug('Save passed step data', preset, step);

        this.assertProgressLoaded();

        const passedSteps = this.state.progress.presetPassedSteps[preset] ?? [];

        if (passedSteps.includes(step)) {
            this.logger.debug('Step already passed', preset, step);
            return;
        }

        this.state.progress.presetPassedSteps[preset] = [...passedSteps, step];

        // eslint-disable-next-line callback-return
        callback?.();

        await this.checkAndProcessPresetFinish(preset);

        await this.updateProgress();
    }

    private async checkAndProcessPresetFinish(preset: Presets) {
        this.assertProgressLoaded();
        const steps = this.options.config.presets[preset]?.steps.map((step) => step.slug) ?? [];

        const isFinishPreset = steps.every((stepName) =>
            this.state.progress?.presetPassedSteps[preset]?.includes(stepName),
        );

        if (isFinishPreset) {
            await this.finishPreset(preset, false);
            await this.updateBaseState();
        }
    }

    private async updateProgress() {
        this.assertProgressLoaded();
        this.logger.debug('Update progress data', this.state.progress);

        this.emitChange();

        await this.options.onSave.progress(this.state.progress);
    }

    private async updateBaseState() {
        this.logger.debug('Update onboarding state', this.state.base);

        this.emitChange();

        await this.options.onSave.state(this.state.base);
    }

    private async ensureRunning() {
        if (this.status === 'active') {
            return;
        }

        if (!this.progressLoadingPromise) {
            this.progressLoadingPromise = this.options.getProgressState();
        }

        this.logger.debug('Loading onboarding progress data');
        try {
            const newProgressState = await this.progressLoadingPromise;
            this.state.progress = {
                ...defaultProgress,
                ...newProgressState,
            };
            this.status = 'active';
            this.emitChange();

            this.logger.debug('Onboarding progress data loaded');
        } catch (e) {
            this.logger.error('progress data loading error');
        }
    }

    private ensurePresetExists(preset: string): asserts preset is Presets {
        // @ts-ignore
        if (!this.options.config.presets[preset]) {
            throw new Error('No preset in config');
        }
    }

    private checkReachedHints() {
        this.reachedHints.forEach((stepData, stepSlug) => {
            if (!stepData.element.isConnected) {
                this.reachedHints.delete(stepSlug);
            }
        });

        this.logger.debug(`Check reached hints. Found ${this.reachedHints.size}`);

        this.reachedHints.forEach((stepData) => {
            this.stepElementReached(stepData);
        });
    }

    private checkIsActivePreset(preset: string) {
        return this.state.base.activePresets.includes(preset);
    }

    private assertProgressLoaded(): asserts this is this & {
        state: {base: BaseState; progress: ProgressState};
    } {
        if (!this.state.progress) {
            this.logger.error('Onboarding progress not loaded');
            throw new Error('Onboarding progress not loaded');
        }
    }

    private getStepBySlug(stepSlug: Steps) {
        for (const presetName of this.state.base.activePresets) {
            if (!this.options.config.presets[presetName as Presets]) {
                continue;
            }

            const step = this.options.config.presets[presetName as Presets].steps.find(
                (presetStep) => presetStep.slug === stepSlug,
            );

            if (step) {
                return step;
            }
        }

        return undefined;
    }

    private emitChange = () => {
        this.state = {...this.state};

        for (const listener of this.stateListeners) {
            listener();
        }
    };
}
