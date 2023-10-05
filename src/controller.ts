import type {BaseState, InitOptions, ProgressState, ReachElementParams} from './types';
import {HintStore} from './hints/hintStore';
import {createLogger} from './logger';
import {CommonPreset, PresetStatus} from './types';
import {createDebounceHandler} from './debounce';

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
    reachedElements: Map<Steps, HTMLElement>;
    hintStore: HintStore<HintParams, Presets, Steps>;
    logger: ReturnType<typeof createLogger>;
    stateListeners: Set<Listener>;
    passStepListeners: Set<Listener>;

    saveBaseState: () => void;
    saveProgressState: () => void;

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
        this.reachedElements = new Map();

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

        this.saveBaseState = createDebounceHandler(() => {
            this.options.onSave.state(this.state.base);
        }, 100);

        this.saveProgressState = createDebounceHandler(() => {
            this.assertProgressLoaded();

            this.options.onSave.progress(this.state.progress);
        }, 100);
    }

    passStep = async (stepSlug: Steps) => {
        this.logger.debug('Step passed', stepSlug);

        const preset = this.findAvailablePresetWithStep(stepSlug);

        if (!preset) {
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

        this.reachedElements.set(stepSlug, element);

        const preset = this.findActivePresetWithStep(stepSlug);

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
        const allUserPresetSlugs = [
            ...new Set([
                ...Object.keys(this.options.config.presets),
                ...this.state.base.availablePresets,
                ...this.state.base.activePresets,
                ...(this.state.progress?.finishedPresets ?? []),
            ]),
        ];

        const userExistedPresetSlugs = allUserPresetSlugs.filter(this.isVisiblePreset) as Presets[];

        return userExistedPresetSlugs.map((presetSlug) => {
            let status: PresetStatus = 'unPassed';

            const slug = this.resolvePresetSlug(presetSlug);

            if (this.state.base.activePresets.includes(slug)) {
                status = 'inProgress';
            } else if (this.state.progress?.finishedPresets.includes(slug)) {
                status = 'finished';
            }

            return {
                slug: presetSlug,
                name: (this.options.config.presets[presetSlug] as CommonPreset<HintParams, Steps>)
                    .name,
                description: (
                    this.options.config.presets[presetSlug] as CommonPreset<HintParams, Steps>
                ).description,
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

    suggestPresetOnce = async (
        preset: string,
        wizardState: BaseState['wizardState'] = 'visible',
    ) => {
        this.logger.debug('Suggest preset', preset);

        if (this.state.base.suggestedPresets.includes(preset)) {
            this.logger.debug('Preset has already been suggested', preset);
            return;
        }

        await this.setWizardState(wizardState);
        await this.runPreset(preset);
    };

    runPreset = async (presetToRunSlug: string) => {
        this.ensurePresetExists(presetToRunSlug);

        const presetToRun = this.options.config.presets[presetToRunSlug];
        const presetSlug = (
            presetToRun.type === 'combined' ? await presetToRun.pickPreset() : presetToRunSlug
        ) as Presets;

        this.logger.debug('Running preset', presetSlug);

        this.options.hooks?.onRunPreset?.({preset: presetSlug});
        this.options.config.presets[presetToRunSlug].hooks?.onStart?.();

        if (presetSlug !== presetToRunSlug) {
            this.options.config.presets[presetSlug].hooks?.onStart?.();
        }

        if (!this.state.base.availablePresets.includes(presetSlug)) {
            this.state.base.availablePresets.push(presetSlug);
        }

        if (this.state.base.activePresets.includes(presetSlug)) {
            return;
        }

        this.state.base.activePresets.push(presetSlug);
        this.state.base.suggestedPresets.push(presetSlug);

        this.hintStore.closeHint();

        const actualPreset = this.options.config.presets[presetSlug] as CommonPreset<
            HintParams,
            Steps
        >;
        actualPreset.steps?.forEach(({slug}) => {
            this.showedHints.delete(slug);
        });

        this.checkReachedHints();

        await this.updateBaseState();
        this.logger.debug('Preset ran', presetSlug);
    };

    finishPreset = async (presetToFinish: Presets, shouldSave = true) => {
        // take normal or find internal
        const presetSlug = this.resolvePresetSlug(presetToFinish);
        this.logger.debug('Preset finished', presetToFinish);

        this.options.hooks?.onFinishPreset?.({preset: presetSlug});
        this.options.config.presets[presetToFinish]?.hooks?.onEnd?.();

        if (presetSlug !== presetToFinish) {
            this.options.config.presets[presetSlug].hooks?.onEnd?.();
        }

        await this.ensureRunning();
        this.assertProgressLoaded();

        this.state.base.activePresets = this.state.base.activePresets.filter(
            (activePresetSlug) => activePresetSlug !== presetSlug,
        );

        if (!this.state.progress.finishedPresets.includes(presetSlug)) {
            this.state.progress.finishedPresets?.push(presetSlug);
        }

        if (shouldSave) {
            await this.updateBaseState();
            await this.updateProgress();
        }
    };

    resetPresetProgress = async (presetArg: string | string[]) => {
        this.logger.debug('Reset progress for', presetArg);
        await this.ensureRunning();
        this.assertProgressLoaded();

        const presets = this.filterExistedPresets(
            Array.isArray(presetArg) ? presetArg : [presetArg],
        ).map((preset) => this.resolvePresetSlug(preset));

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
        this.logger.debug('Progress reset finished', presetArg);
    };

    private resolvePresetSlug = (presetSlug: Presets) => {
        const preset = this.options.config.presets[presetSlug];

        return preset.type === 'combined' ? this.findInternalPreset(presetSlug) : presetSlug;
    };

    private findInternalPreset = (presetSlug: Presets) => {
        const preset = this.options.config.presets[presetSlug];

        if (preset.type !== 'combined') {
            throw new Error('not internal preset');
        }

        const activeInternalPreset = this.state.base.activePresets.find((activePreset) =>
            preset.internalPresets.includes(activePreset),
        ) as Presets;

        const finishedInternalPreset = this.state.progress?.finishedPresets.find((finishedPreset) =>
            preset.internalPresets.includes(finishedPreset),
        ) as Presets;

        return activeInternalPreset || finishedInternalPreset;
    };

    private filterExistedPresets = (presets: string[]) => {
        // @ts-ignore
        return presets.filter((slug) => Boolean(this.options.config.presets[slug])) as Presets[];
    };

    private isVisiblePreset = (presetSlug: string) => {
        // @ts-ignore
        const preset = this.options.config.presets[presetSlug];

        if (!preset) {
            return false;
        }

        const isInternal = preset.type === 'internal';
        const userHasPreset =
            this.state.base.availablePresets.includes(presetSlug) ||
            this.state.progress?.finishedPresets.includes(presetSlug);
        const isPresetMarkAsVisible = !preset.visibility || preset.visibility === 'visible';

        return !isInternal && (isPresetMarkAsVisible || userHasPreset);
    };

    private findNextStepForPreset(presetSlug: Presets) {
        this.assertProgressLoaded();

        const preset = this.options.config.presets[presetSlug as Presets];

        if (!preset || preset.type === 'combined') {
            return false;
        }

        const presetSteps = preset.steps.map((step) => step.slug);
        const passedSteps = this.state.progress.presetPassedSteps[presetSlug] ?? [];

        if (!presetSteps || !passedSteps) {
            this.logger.debug('Unknown preset', preset);
            return undefined;
        }

        return Controller.findNextUnpassedStep(presetSteps, passedSteps);
    }

    private findActivePresetWithStep(stepSlug: Steps) {
        const presets = this.findPresetsWithStep(stepSlug).filter((presetName) =>
            this.state.base.activePresets.includes(presetName),
        );

        if (presets.length > 1) {
            this.logger.error('More than 1 active preset for step', stepSlug);
        }

        return presets[0];
    }

    private findAvailablePresetWithStep(stepSlug: Steps) {
        const presets = this.findPresetsWithStep(stepSlug).filter((presetName) =>
            this.state.base.availablePresets.includes(presetName),
        );

        let targetPreset = presets[0];
        if (presets.length > 1) {
            this.logger.error('More than 1 available preset for step', stepSlug, presets);
            const activePreset = presets.find((presetName) =>
                this.state.base.activePresets.includes(presetName),
            );

            if (activePreset) {
                targetPreset = activePreset;
            }
        }

        return targetPreset;
    }

    private findPresetsWithStep(stepSlug: Steps) {
        return Object.keys(this.options.config.presets).filter((presetName) => {
            const preset = this.options.config.presets[presetName as Presets];

            if (!preset || preset.type === 'combined') {
                return false;
            }

            return preset?.steps.some((step) => step.slug === stepSlug) ?? false;
        }) as Array<Presets>;
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

    private async checkAndProcessPresetFinish(presetSlug: Presets) {
        this.assertProgressLoaded();
        const preset = this.options.config.presets[presetSlug];

        if (!preset || preset.type === 'combined') {
            // сюда не должны попадать combined пресеты
            return;
        }

        const steps = preset.steps.map((step) => step.slug) ?? [];

        const isFinishPreset = steps.every((stepName) =>
            this.state.progress?.presetPassedSteps[presetSlug]?.includes(stepName),
        );

        if (isFinishPreset) {
            await this.finishPreset(presetSlug, false);
            await this.updateBaseState();
        }
    }

    private async updateProgress() {
        this.assertProgressLoaded();
        this.logger.debug('Update progress data', this.state.progress);

        this.emitChange();

        await this.saveProgressState();
    }

    private async updateBaseState() {
        this.logger.debug('Update onboarding state', this.state.base);

        this.emitChange();

        await this.saveBaseState();
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
        this.reachedElements.forEach((element, stepSlug) => {
            if (!element.isConnected) {
                this.reachedElements.delete(stepSlug);
            }
        });

        this.logger.debug(`Check reached hints. Found ${this.reachedElements.size}`);

        this.reachedElements.forEach((element, stepSlug) => {
            this.stepElementReached({stepSlug, element});
        });
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
            const preset = this.options.config.presets[presetName as Presets];
            if (!preset) {
                continue;
            }

            if (preset.type === 'combined') {
                continue;
            }

            const step = preset.steps.find((presetStep) => presetStep.slug === stepSlug);

            if (step) {
                return step;
            }
        }

        return undefined;
    }

    private emitChange = () => {
        this.state = JSON.parse(JSON.stringify(this.state));

        for (const listener of this.stateListeners) {
            listener();
        }
    };
}
