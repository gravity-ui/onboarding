import type {
    BaseState,
    CommonPreset,
    EventTypes,
    EventsMap,
    HintCloseSource,
    InitOptions,
    Preset,
    PresetField,
    PresetStatus,
    PresetStep,
    ProgressState,
    ReachElementParams,
    ResolvedOptions,
    UserPreset,
} from './types';
import {HintStore} from './hints/hintStore';
import {Logger, createLogger} from './logger';
import {createDebounceHandler} from './debounce';
import {EventEmitter} from './event-emitter';

type Listener = () => void;

let instanceCounter = 0;

const defaultLoggerOptions = {
    context: 'Onboarding',
};

const getDefaultProgressState = () => ({
    presetPassedSteps: {},
    finishedPresets: [],
});

export class Controller<HintParams, Presets extends string, Steps extends string> {
    static findNextUnpassedStep(presetSteps: string[], passedSteps: string[]): string | undefined {
        if (!presetSteps) {
            return undefined;
        }

        if (passedSteps.length === 0) {
            return presetSteps[0];
        }

        if (passedSteps.includes(presetSteps[presetSteps.length - 1])) {
            // all steps passed
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

        return undefined;
    }

    options: ResolvedOptions<HintParams, Presets, Steps>;
    state: {
        base: BaseState;
        progress?: ProgressState;
    };
    status: 'idle' | 'active' | 'disabled';
    progressLoadingPromise: Promise<Partial<ProgressState>> | undefined;
    closedHints: Set<Steps>;
    reachedElements: Map<Steps, Element>;
    hintStore: HintStore<HintParams, Presets, Steps>;
    logger: Logger;
    passStepListeners: Set<Listener>;
    events: EventEmitter<EventTypes, EventsMap, any>;

    saveBaseState: () => void;
    saveProgressState: () => void;

    private presetsLoadingPromise: Promise<void> | undefined;

    constructor(
        options: InitOptions<HintParams, Presets, Steps>,
        hintStore?: HintStore<HintParams, Presets, Steps>,
    ) {
        if (options.globalSwitch === 'off') {
            this.status = 'disabled';
        } else {
            this.status = 'idle';
        }

        this.options = this.resolveOptions(options);

        this.events = new EventEmitter(this);
        if (this.options.hooks) {
            for (const [hookName, hookFunction] of Object.entries(this.options.hooks)) {
                if (hookFunction) {
                    this.events.subscribe(hookName as EventTypes, hookFunction);
                }
            }
        }

        this.state = {
            base: this.fulfillUserBaseState(options.baseState ?? {}),
        };

        this.closedHints = new Set();
        this.reachedElements = new Map();

        this.hintStore = hintStore || new HintStore(this.events);
        this.passStepListeners = new Set();
        this.logger = createLogger({
            ...defaultLoggerOptions,
            ...this.options.logger,
        });

        if (this.options.debugMode) {
            this.enterDebugMode();
        }

        this.logger.debug('Initialized');

        if (instanceCounter > 0) {
            this.logger.error(
                'Should be only one Controller instance for page. Multiple instances can cause inconsistent state and race conditions',
            );
        }
        instanceCounter++;

        if (this.options.plugins) {
            for (const plugin of this.options.plugins) {
                plugin.apply({onboarding: this});
                this.logger.debug('Init onboarding plugin', plugin.name);
            }
        }

        this.saveBaseState = createDebounceHandler(() => {
            this.options.onSave.state(this.state.base);
        }, 100);

        this.saveProgressState = createDebounceHandler(() => {
            this.progressLoadedGuard();

            this.options.onSave.progress(this.state.progress);
        }, 100);

        this.events.emit('init', {});
    }

    enterDebugMode = () => {
        // @ts-ignore
        window.gravityOnboarding = this;
        this.logger.debug('Controller available as window.gravityOnboarding', this);
    };

    resolveOptions = (
        options: InitOptions<HintParams, Presets, Steps>,
    ): ResolvedOptions<HintParams, Presets, Steps> => {
        const resolvedPresets = {} as Record<Presets, Preset<HintParams, Steps>>;

        for (const [presetKey, preset] of Object.entries<PresetField<HintParams, Steps>>(
            options.config.presets,
        )) {
            resolvedPresets[presetKey as Presets] = this.resolveOnePreset(presetKey, preset);
        }

        return {
            ...options,
            config: {
                ...options.config,
                presets: resolvedPresets,
            },
        };
    };

    passStep = async (stepSlug: Steps) => {
        if (this.status === 'disabled') {
            return;
        }

        await this.ensurePresetsLoaded();

        this.logger.debug('Step passed', stepSlug);

        const preset = this.findAvailablePresetWithStep(stepSlug);

        if (!preset) {
            return;
        }

        await this.ensureRunning();

        const step = this.getStepBySlugAndPreset(stepSlug, preset);
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

        await this.saveStepData(preset, stepSlug, () => {
            step?.hooks?.onStepPass?.();
            this.events.emit('stepPass', {preset, step: stepSlug});

            if (step?.passMode !== 'onShowHint') {
                this.logger.debug('Close hint on step', stepSlug);
                this.closeHintByUser(undefined, 'stepPassed');
                this.checkReachedHints();
            }
        });
    };

    skipStep = async (stepSlug: Steps, presetSlug?: Presets) => {
        if (this.status === 'disabled') {
            return;
        }

        await this.ensurePresetsLoaded();

        const presets = this.findPresetsWithStep(stepSlug).filter(
            (candidate) => presetSlug === undefined || candidate === presetSlug,
        );
        if (!presets.length) {
            return;
        }

        await this.ensureRunning();
        this.progressLoadedGuard();
        const unfinished = presets.filter(
            (preset) => !this.state.progress.finishedPresets.includes(preset),
        );
        const preset =
            unfinished.find((candidate) => this.hintStore.state.hint?.preset === candidate) ??
            unfinished.find((candidate) => this.state.base.activePresets.includes(candidate)) ??
            unfinished.find((candidate) => this.state.base.availablePresets.includes(candidate)) ??
            unfinished[0];
        if (!preset) {
            return;
        }

        const step = this.getStepBySlugAndPreset(stepSlug, preset);
        await this.saveStepData(
            preset,
            stepSlug,
            () => this.notifyStepSkip(preset, stepSlug, step),
            true,
        );
    };

    passOrSkipStep = (stepSlug: Steps) => {
        // Attribute the action using the hint visible when the action occurred,
        // before asynchronous preset or progress loading can display another hint.
        const {open, hint} = this.hintStore.state;
        return open && hint?.step.slug === stepSlug
            ? this.passStep(stepSlug)
            : this.skipStep(stepSlug);
    };

    syncPresetProgress = async (
        preset: Presets,
        {passedSteps = [], skippedSteps = []}: {passedSteps?: Steps[]; skippedSteps?: Steps[]},
    ) => {
        if (this.status === 'disabled') {
            return;
        }
        await this.ensurePresetsLoaded();
        const config = this.options.config.presets[preset];
        if (!config || config.type === 'combined') {
            return;
        }
        await this.ensureRunning();
        const {knownSteps, storedPassed, storedSkipped, newSkipped} = this.mergePresetProgress(
            preset,
            config.steps,
            passedSteps,
            skippedSteps,
        );

        let results: PromiseSettledResult<void>[];
        try {
            const hint = this.hintStore.state.hint;
            if (hint?.preset === preset) {
                const step = hint.step.slug;
                if (storedPassed.has(step) || storedSkipped.has(step)) {
                    this.closeHint(step, 'progressSynced');
                }
            }
        } finally {
            results = await Promise.allSettled(
                newSkipped.map((step) => this.notifyStepSkip(preset, step, knownSteps.get(step))),
            );
            try {
                await this.checkAndProcessPresetFinish(preset);
            } finally {
                this.checkReachedHints();
                await this.updateProgress();
            }
        }
        const failed = results.find((result) => result.status === 'rejected');
        if (failed?.status === 'rejected') {
            throw failed.reason;
        }
    };

    setWizardState = async (state: BaseState['wizardState']) => {
        if (this.status === 'disabled') {
            return;
        }

        if (state === 'visible' || state === 'collapsed') {
            // eslint-disable-next-line no-void
            void this.ensurePresetsLoaded();
        }

        this.state.base.wizardState = state;
        await this.events.emit('wizardStateChanged', {wizardState: state});
        await this.updateBaseState();
    };

    setOnboardingEnabled = async (enabled: boolean) => {
        if (this.status === 'disabled') {
            return;
        }

        this.state.base.enabled = enabled;
        await this.updateBaseState();
    };

    stepElementReached = async ({
        stepSlug,
        element,
    }: Omit<ReachElementParams<Presets, Steps>, 'preset'>) => {
        if (this.status === 'disabled') {
            return;
        }

        await this.ensurePresetsLoaded();

        this.logger.debug('Step element reached', stepSlug, element);
        this.reachedElements.set(stepSlug, element);

        const preset = this.findActivePresetWithStep(stepSlug);

        if (!preset) {
            this.logger.debug('Not found active preset for step', stepSlug);
            return;
        }

        const stepData = {
            preset,
            stepSlug,
            element,
        };

        const shouldProcessAppearance = await this.events.emit('stepElementReached', {stepData});

        if (shouldProcessAppearance) {
            await this.processElementAppearance(stepData);
        } else {
            this.logger.debug('Reject process appearance', stepSlug);
        }
    };

    processElementAppearance = async (stepData: ReachElementParams<Presets, Steps>) => {
        const {preset, element, stepSlug} = stepData;

        if (!this.state.base.enabled) {
            this.logger.debug('Onboarding is not enabled', preset, stepSlug);
            return;
        }

        await this.ensureRunning();
        this.progressLoadedGuard();

        if (this.hintStore.state.hint?.step.slug === stepSlug && this.hintStore.state.open) {
            this.logger.debug('Updating hint anchor', preset, stepSlug);
            this.hintStore.updateHintAnchor({element, step: stepSlug});
        }

        if (this.closedHints.has(stepSlug)) {
            this.logger.debug('Hint for step was shown and closed', preset, stepSlug);
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

        const step = this.getStepBySlugAndPreset(stepSlug, preset);

        if (!step) {
            this.logger.debug('Unknown step', preset, stepSlug);
            return;
        }

        if (!stepData.element.isConnected) {
            this.logger.debug('Element disappeared', stepData.element, stepSlug);
            return;
        }

        const allowRun = await this.events.emit('beforeShowHint', {stepData});
        if (!allowRun) {
            this.logger.debug('Show hint has been canceled by beforeShowHint event', stepData);
            return;
        }

        // The anchor may be replaced while asynchronous checks are pending.
        const currentElement = this.reachedElements.get(stepSlug);
        if (!currentElement?.isConnected) {
            this.logger.debug('Element disappeared while preparing hint', currentElement, stepSlug);
            return;
        }

        if (this.hintStore.state.open) {
            return;
        }

        if (
            !this.state.base.activePresets.includes(preset) ||
            this.state.progress.finishedPresets.includes(preset) ||
            this.findNextStepForPreset(preset) !== stepSlug
        ) {
            return;
        }

        this.logger.debug(`Display hint for step ${stepSlug}`);
        this.events.emit('showHint', {preset, step: stepSlug});

        this.options.showHint?.({preset, element: currentElement, step});
        this.hintStore.showHint({preset, element: currentElement, step});

        if (step.passMode === 'onShowHint') {
            await this.passStep(stepSlug);
        }
    };

    stepElementDisappeared = (stepSlug: Steps) => {
        this.logger.debug(`Step element ${stepSlug} disappeared`);

        const step = this.getStepBySlug(stepSlug);

        if (step?.closeOnElementUnmount !== false) {
            this.closeHint(stepSlug, 'elementHidden');
        }
    };

    closeHintByUser = (stepSlug?: Steps, eventSource: HintCloseSource = 'closedByUser') => {
        const currentHintStep = this.hintStore.state.hint?.step.slug;
        this.logger.debug('Close hint(internal)', currentHintStep);
        if (stepSlug && stepSlug !== currentHintStep) {
            this.logger.debug('Hint for step', stepSlug, 'is not current hint');
            return;
        }

        if (currentHintStep) {
            this.closedHints.add(currentHintStep);
            const preset = this.findActivePresetWithStep(currentHintStep);
            const step = this.getStepBySlugAndPreset(currentHintStep, preset);
            step?.hooks?.onCloseHintByUser?.({eventSource});
            step?.hooks?.onCloseHint?.({eventSource});
        }

        if (this.hintStore.state.hint) {
            this.events.emit('closeHintByUser', {
                hint: this.hintStore.state.hint,
                eventSource,
            });
        }

        this.hintStore.closeHint(eventSource);
        this.checkReachedHints();
    };

    getSnapshot = () => {
        return this.state;
    };

    subscribe = (listener: Listener) => {
        this.events.subscribe('stateChange', listener);

        return () => {
            this.events.unsubscribe('stateChange', listener);
        };
    };

    get userPresets() {
        if (this.status !== 'disabled') {
            // eslint-disable-next-line no-void
            void this.ensurePresetsLoaded();
        }
        const allUserPresetSlugs = [
            ...new Set([
                ...Object.keys(this.options.config.presets),
                ...this.state.base.availablePresets,
                ...this.state.base.activePresets,
                ...(this.state.progress?.finishedPresets ?? []),
            ]),
        ];

        const userExistedPresetSlugs = allUserPresetSlugs.filter(this.isVisiblePreset) as Presets[];

        return userExistedPresetSlugs
            .map((presetSlug) => {
                let status: PresetStatus = 'unPassed';
                let slug: Presets | undefined;

                try {
                    slug = this.resolvePresetSlug(presetSlug);
                } catch {
                    status = 'unPassed';
                }

                if (!slug) {
                    status = 'unPassed';
                } else if (this.state.base.activePresets.includes(slug)) {
                    status = 'inProgress';
                } else if (this.state.progress?.finishedPresets.includes(slug)) {
                    status = 'finished';
                }

                return {
                    slug: presetSlug,
                    name: (
                        this.options.config.presets[presetSlug] as CommonPreset<HintParams, Steps>
                    ).name,
                    description: (
                        this.options.config.presets[presetSlug] as CommonPreset<HintParams, Steps>
                    ).description,
                    status,
                };
            })
            .filter((userPreset) => Boolean(userPreset)) as UserPreset<Presets>[];
    }

    addPreset = async (presetArg: string | string[]) => {
        if (this.status === 'disabled') {
            return;
        }

        await this.ensurePresetsLoaded();

        const presets = this.filterExistedPresets(
            Array.isArray(presetArg) ? presetArg : [presetArg],
        );
        this.logger.debug('Add new presets', presets);

        for (const preset of presets) {
            this.events.emit('addPreset', {preset});

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
            return false;
        }

        if (this.status !== 'disabled') {
            await this.ensurePresetsLoaded();
        }

        const allowRun = await this.events.emit('beforeSuggestPreset', {preset});

        if (!allowRun) {
            this.logger.debug('Preset suggestion cancelled', preset);
            return false;
        }

        return this.runPreset(preset);
    };

    runPreset = async (presetToRunSlug: string) => {
        if (this.status === 'disabled') {
            return false;
        }

        await this.ensurePresetsLoaded();

        if (!this.presetExistsGuard(presetToRunSlug)) {
            return false;
        }

        const presetToRun = this.options.config.presets[presetToRunSlug];
        const presetSlug = (
            presetToRun.type === 'combined' ? await presetToRun.pickPreset() : presetToRunSlug
        ) as Presets;

        await this.ensureRunning();
        if (this.getPresetOutcome(presetSlug) === 'skipped') {
            return false;
        }

        this.logger.debug('Running preset', presetSlug);

        await presetToRun.hooks?.onBeforeStart?.();
        if (presetSlug !== presetToRunSlug) {
            await this.options.config.presets[presetSlug].hooks?.onBeforeStart?.();
        }

        await this.events.emit('beforeRunPreset', {preset: presetSlug});

        if (!this.state.base.availablePresets.includes(presetSlug)) {
            this.state.base.availablePresets.push(presetSlug);
        }

        if (this.state.base.activePresets.includes(presetSlug)) {
            return false;
        }

        this.state.base.activePresets.push(presetSlug);

        if (!this.state.base.suggestedPresets.includes(presetSlug)) {
            this.state.base.suggestedPresets.push(presetSlug);
        }

        await this.closeHint();

        const actualPreset = this.options.config.presets[presetSlug] as CommonPreset<
            HintParams,
            Steps
        >;
        actualPreset.steps?.forEach(({slug}) => {
            this.closedHints.delete(slug);
        });

        this.events.emit('runPreset', {preset: presetSlug});
        presetToRun.hooks?.onStart?.();
        if (presetSlug !== presetToRunSlug) {
            this.options.config.presets[presetSlug].hooks?.onStart?.();
        }

        this.checkReachedHints();

        await this.updateBaseState();
        this.logger.debug('Preset ran', presetSlug);

        return true;
    };

    finishPreset = (presetToFinish: Presets, shouldSave = true) =>
        this.endPreset(presetToFinish, shouldSave, 'finishPreset');

    getPresetOutcome = (presetSlug: Presets): 'finished' | 'skipped' | undefined => {
        const preset = this.options.config.presets[presetSlug];
        const progress = this.state.progress;
        if (!progress || !preset || preset.type === 'combined') {
            return undefined;
        }

        const steps = preset.steps.map(({slug}) => slug);
        const passedSteps = progress.presetPassedSteps[presetSlug] ?? [];
        const skippedSteps = progress.presetSkippedSteps?.[presetSlug] ?? [];
        if (
            steps.length &&
            steps.every((step) => skippedSteps.includes(step)) &&
            !steps.some((step) => passedSteps.includes(step))
        ) {
            return 'skipped';
        }
        if (
            progress.finishedPresets.includes(presetSlug) ||
            (steps.length &&
                (steps.some((step) => skippedSteps.includes(step))
                    ? !this.findNextStepForPreset(presetSlug)
                    : passedSteps.includes(steps[steps.length - 1])))
        ) {
            return 'finished';
        }
        return undefined;
    };

    resetPresetProgress = async (
        presetArg: string | string[],
        {
            removeFromSuggested = false,
            preserveSkippedSteps = false,
        }: {removeFromSuggested?: boolean; preserveSkippedSteps?: boolean} = {},
    ) => {
        if (this.status === 'disabled') {
            return;
        }

        await this.ensurePresetsLoaded();

        this.logger.debug('Reset progress for', presetArg);
        await this.ensureRunning();
        this.progressLoadedGuard();

        const presets = this.filterExistedPresets(
            Array.isArray(presetArg) ? presetArg : [presetArg],
        )
            .map((preset) => this.resolvePresetSlug(preset))
            .filter((preset) => Boolean(preset)) as Presets[];

        const presetsToReopen = preserveSkippedSteps
            ? presets.filter((preset) => this.getPresetOutcome(preset) !== 'skipped')
            : presets;
        this.state.progress.finishedPresets = this.state.progress.finishedPresets.filter(
            (preset) => !presetsToReopen.includes(preset as Presets),
        );

        for (const preset of presets) {
            delete this.state.progress.presetPassedSteps[preset];
            if (!preserveSkippedSteps) {
                delete this.state.progress.presetSkippedSteps?.[preset];
            }
        }

        this.state.base.activePresets = this.state.base.activePresets.filter(
            (preset) => !presets.includes(preset as Presets),
        );

        if (removeFromSuggested) {
            this.state.base.suggestedPresets = this.state.base.suggestedPresets.filter(
                (preset) => !presets.includes(preset as Presets),
            );
        }

        this.events.emit('resetPresetProgress', {presets});

        await this.updateBaseState();
        await this.updateProgress();
        this.logger.debug('Progress reset finished', presetArg);
    };

    async ensureRunning() {
        if (this.status === 'active' || this.status === 'disabled') {
            return;
        }

        const progressStateFromOptions = this.options.progressState;
        if (progressStateFromOptions) {
            this.initProgressState(progressStateFromOptions);
            return;
        }

        if (!this.progressLoadingPromise) {
            this.progressLoadingPromise = this.options.getProgressState();
        }

        this.logger.debug('Loading onboarding progress data');
        try {
            const progress = await this.progressLoadingPromise;
            if (!this.state.progress) {
                this.initProgressState(progress);
            }
            this.status = 'active';
        } catch {
            this.logger.error('progress data loading error');
        }
    }

    initProgressState(state: Partial<ProgressState>) {
        this.state.progress = {
            ...getDefaultProgressState(),
            ...state,
        };
        this.status = 'active';
        this.emitStateChange();

        this.logger.debug('Onboarding progress data initialized');
    }

    async resetToDefaultState() {
        this.state = {
            base: this.fulfillUserBaseState({}),
            progress: getDefaultProgressState(),
        };

        await this.updateBaseState();
        await this.updateProgress();
    }

    closeHint = (stepSlug?: Steps, eventSource: HintCloseSource = 'externalEvent') => {
        const hint = this.hintStore.state.hint;
        const currentHintStep = hint?.step.slug;
        this.logger.debug('Close hint(internal)', currentHintStep);
        if (stepSlug && stepSlug !== currentHintStep) {
            this.logger.debug('Hint for step', stepSlug, 'is not current hint');
            return;
        }

        try {
            if (hint) {
                const step = this.getStepBySlugAndPreset(hint.step.slug, hint.preset);
                step?.hooks?.onCloseHint?.({eventSource});
            }
        } finally {
            this.hintStore.closeHint(eventSource);
        }
    };

    emitStateChange = () => {
        this.state = JSON.parse(JSON.stringify(this.state));

        this.events.emit('stateChange', {state: this.state});
    };

    checkReachedHints() {
        this.reachedElements.forEach((element, stepSlug) => {
            if (!element.isConnected) {
                this.reachedElements.delete(stepSlug);
            }
        });

        this.logger.debug(`Check reached hints. Found ${this.reachedElements.size}`);

        for (const [stepSlug, element] of this.reachedElements) {
            this.stepElementReached({stepSlug, element});
        }
    }

    private endPreset = async (
        presetToFinish: Presets,
        shouldSave: boolean,
        event: 'finishPreset' | 'skipPreset',
    ) => {
        if (this.status === 'disabled') {
            return false;
        }

        await this.ensurePresetsLoaded();

        // take normal or find internal
        const presetSlug = this.resolvePresetSlug(presetToFinish);
        if (!presetSlug) {
            return false;
        }

        await this.ensureRunning();
        this.progressLoadedGuard();

        if (this.state.progress.finishedPresets.includes(presetSlug)) {
            this.logger.debug('Preset already finished', presetToFinish);
            return true;
        }

        this.logger.debug(event, presetToFinish);

        this.state.base.activePresets = this.state.base.activePresets.filter(
            (activePresetSlug) => activePresetSlug !== presetSlug,
        );

        this.state.progress.finishedPresets?.push(presetSlug);

        const skipAware =
            event === 'skipPreset' ||
            Boolean(this.state.progress.presetSkippedSteps?.[presetSlug]?.length);
        try {
            const notification = this.events.emit(event, {preset: presetSlug}, skipAware);
            if (skipAware) {
                await notification;
            }
        } finally {
            this.options.config.presets[presetToFinish]?.hooks?.onEnd?.();

            if (presetSlug !== presetToFinish) {
                this.options.config.presets[presetSlug].hooks?.onEnd?.();
            }

            if (shouldSave) {
                await this.updateBaseState();
                await this.updateProgress();
            }
        }

        return true;
    };

    private resolveOnePreset = (
        presetKey: string,
        preset: PresetField<HintParams, Steps>,
    ): Preset<HintParams, Steps> => {
        return typeof preset === 'function'
            ? preset({
                  goNextStep: this.goNextStep.bind(this, presetKey as Presets),
                  goPrevStep: this.goPrevStep.bind(this, presetKey as Presets),
              })
            : preset;
    };

    private mergeLoadedPresets = (loaded: Record<string, PresetField<HintParams, Steps>>) => {
        const presets = this.options.config.presets as Record<string, Preset<HintParams, Steps>>;
        for (const [presetKey, preset] of Object.entries(loaded)) {
            if (presets[presetKey]) {
                this.logger.error(
                    'Async preset key collides with sync preset, keeping sync entry',
                    presetKey,
                );
                continue;
            }
            presets[presetKey] = this.resolveOnePreset(presetKey, preset);
        }
    };

    private ensurePresetsLoaded = (): Promise<void> => {
        if (!this.options.config.asyncPresets) {
            return Promise.resolve();
        }
        if (this.presetsLoadingPromise) {
            return this.presetsLoadingPromise;
        }

        const loading = this.options.config
            .asyncPresets()
            // catch before then — only loader errors are logged; merge errors propagate as-is
            .catch((err) => {
                this.logger.error('Failed to load async presets', err);
                throw err;
            })
            .then((loadedPresets) => {
                this.mergeLoadedPresets(loadedPresets);
                this.emitStateChange();
            });
        // attach a no-op handler so fire-and-forget callers don't leak an unhandled rejection
        loading.catch(() => {});
        this.presetsLoadingPromise = loading;

        return loading;
    };

    private fulfillUserBaseState = (userState: Partial<BaseState>): BaseState => {
        const nowDate = this.getOnboardingDate();
        const defaultState = {
            availablePresets: [],
            activePresets: [],
            suggestedPresets: [],
            wizardState: 'hidden' as const,
            enabled: false,
            lastUserActivity: nowDate.toUTCString(),
        };

        const isUserStateComplete =
            Object.keys(userState).length === Object.keys(defaultState).length;

        if (isUserStateComplete) {
            return userState as BaseState;
        }

        this.events.emit('applyDefaultState', {});

        return {
            ...defaultState,
            ...this.options.customDefaultState,
            ...userState,
        } as BaseState;
    };

    private getOnboardingDate() {
        return this.options.dateNow?.() ?? new Date();
    }

    private resolvePresetSlug = (presetSlug: string) => {
        if (!this.presetExistsGuard(presetSlug)) {
            return undefined;
        }
        const preset = this.options.config.presets[presetSlug];

        return preset.type === 'combined' ? this.findInternalPreset(presetSlug) : presetSlug;
    };

    private findInternalPreset = (presetSlug: Presets) => {
        const preset = this.options.config.presets[presetSlug];

        if (preset.type !== 'combined') {
            return undefined;
        }

        const activeInternalPreset = this.state.base.activePresets.find((activePreset) =>
            preset.internalPresets.includes(activePreset),
        ) as Presets | undefined;

        const finishedInternalPreset = this.state.progress?.finishedPresets.find((finishedPreset) =>
            preset.internalPresets.includes(finishedPreset),
        ) as Presets | undefined;

        return activeInternalPreset || finishedInternalPreset;
    };

    private filterExistedPresets = (presets: string[]) => {
        // @ts-ignore
        return presets.filter((slug) => Boolean(this.options.config.presets[slug])) as Presets[];
    };

    private isVisiblePreset = (presetSlug: string) => {
        if (!this.checkPresetExists(presetSlug)) {
            return false;
        }

        const preset = this.options.config.presets[presetSlug as Presets];

        const isInternal = preset.type === 'internal';
        if (isInternal) {
            return false;
        }

        const userHasPreset =
            this.state.base.availablePresets.includes(presetSlug) ||
            this.state.progress?.finishedPresets.includes(presetSlug);

        const presetVisibility = 'visibility' in preset ? preset.visibility : undefined;
        const isPresetMarkAsVisible = presetVisibility !== 'initialHidden';

        return presetVisibility !== 'alwaysHidden' && (isPresetMarkAsVisible || userHasPreset);
    };

    private findNextStepForPreset(presetSlug: Presets) {
        this.progressLoadedGuard();

        const preset = this.options.config.presets[presetSlug as Presets];

        if (!preset || preset.type === 'combined') {
            return false;
        }

        const presetSteps = preset.steps.map((step) => step.slug);
        const passedSteps = this.state.progress.presetPassedSteps[presetSlug] ?? [];
        const skippedSteps = this.state.progress.presetSkippedSteps?.[presetSlug] ?? [];

        if (presetSteps.some((step) => skippedSteps.includes(step))) {
            return presetSteps.find(
                (step) => !passedSteps.includes(step) && !skippedSteps.includes(step),
            );
        }

        return Controller.findNextUnpassedStep(presetSteps, passedSteps) as Steps;
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

    private mergePresetProgress(
        preset: Presets,
        steps: PresetStep<Steps, HintParams | undefined>[],
        passedSteps: Steps[],
        skippedSteps: Steps[],
    ) {
        this.progressLoadedGuard();
        const knownSteps = new Map<Steps, PresetStep<Steps, HintParams | undefined>>();
        for (const step of steps) {
            if (!knownSteps.has(step.slug)) {
                knownSteps.set(step.slug, step);
            }
        }
        const storedPassed = new Set(this.state.progress.presetPassedSteps[preset] ?? []);
        const storedSkipped = new Set(this.state.progress.presetSkippedSteps?.[preset] ?? []);
        const incomingSkipped = new Set(skippedSteps.filter((step) => knownSteps.has(step)));
        if (passedSteps.length) {
            for (const step of passedSteps) {
                if (
                    knownSteps.has(step) &&
                    !storedSkipped.has(step) &&
                    !incomingSkipped.has(step)
                ) {
                    storedPassed.add(step);
                }
            }
            this.state.progress.presetPassedSteps[preset] = [...storedPassed];
        }
        const newSkipped = this.state.progress.finishedPresets.includes(preset)
            ? []
            : [...incomingSkipped].filter(
                  (step) => !storedPassed.has(step) && !storedSkipped.has(step),
              );
        if (newSkipped.length) {
            // Commit the whole batch before callbacks can start another action or sync.
            this.state.progress.presetSkippedSteps ??= {};
            this.state.progress.presetSkippedSteps[preset] = [...storedSkipped, ...newSkipped];
        }
        return {knownSteps, storedPassed, storedSkipped, newSkipped};
    }

    private async notifyStepSkip(
        preset: Presets,
        step: Steps,
        config?: PresetStep<Steps, HintParams | undefined>,
    ) {
        try {
            await config?.hooks?.onStepSkip?.();
        } finally {
            try {
                await this.events.emit('stepSkip', {preset, step}, true);
            } finally {
                if (this.hintStore.state.hint?.preset === preset) {
                    this.closeHint(step, 'stepSkipped');
                }
            }
        }
    }

    private async saveStepData(
        preset: Presets,
        step: Steps,
        callback?: () => void | Promise<void>,
        skipped = false,
    ) {
        this.progressLoadedGuard();

        const passedSteps = this.state.progress.presetPassedSteps[preset] ?? [];
        const skippedSteps = this.state.progress.presetSkippedSteps?.[preset] ?? [];

        if (
            passedSteps.includes(step) ||
            skippedSteps.includes(step) ||
            (skipped && this.state.progress.finishedPresets.includes(preset))
        ) {
            return;
        }

        if (skipped) {
            this.state.progress.presetSkippedSteps ??= {};
            this.state.progress.presetSkippedSteps[preset] = [...skippedSteps, step];
        } else {
            this.state.progress.presetPassedSteps[preset] = [...passedSteps, step];
        }

        if (!skipped) {
            // eslint-disable-next-line callback-return
            callback?.();
            await this.checkAndProcessPresetFinish(preset);
            await this.updateProgress();
            return;
        }

        try {
            // eslint-disable-next-line callback-return
            await callback?.();
        } finally {
            try {
                await this.checkAndProcessPresetFinish(preset);
            } finally {
                this.checkReachedHints();
                await this.updateProgress();
            }
        }
    }

    private async checkAndProcessPresetFinish(presetSlug: Presets) {
        const outcome = this.getPresetOutcome(presetSlug);
        if (outcome) {
            try {
                await this.endPreset(
                    presetSlug,
                    false,
                    outcome === 'finished' ? 'finishPreset' : 'skipPreset',
                );
            } finally {
                await this.updateBaseState();
            }
        }
    }

    private async updateProgress() {
        this.progressLoadedGuard();
        this.logger.debug('Update progress data', this.state.progress);

        this.emitStateChange();

        await this.saveProgressState();
    }

    private async updateBaseState() {
        this.logger.debug('Update onboarding state', this.state.base);

        this.emitStateChange();

        await this.saveBaseState();
    }

    private presetExistsGuard(preset: string): preset is Presets {
        if (!this.checkPresetExists(preset)) {
            this.logger.error('No preset in config', preset);

            if (!this.options.ignoreUnknownPresets) {
                throw new Error('No preset in config');
            }

            return false;
        }

        return true;
    }

    private checkPresetExists(preset: string) {
        return preset in this.options.config.presets;
    }

    private progressLoadedGuard(): asserts this is this & {
        state: {base: BaseState; progress: ProgressState};
    } {
        if (!this.state.progress) {
            this.logger.error('Onboarding progress not loaded');
            throw new Error('Onboarding progress not loaded');
        }
    }

    private getStepBySlug(stepSlug: Steps) {
        for (const presetName of Object.keys(this.options.config.presets)) {
            const step = this.getStepBySlugAndPreset(stepSlug, presetName as Presets);

            if (step) {
                return step;
            }
        }

        return undefined;
    }

    private getStepBySlugAndPreset(stepSlug: Steps, presetSlug: Presets) {
        const targetPreset = this.options.config.presets[presetSlug];

        if (!targetPreset || targetPreset.type === 'combined') {
            return undefined;
        }

        return targetPreset.steps.find((presetStep) => presetStep.slug === stepSlug);
    }

    private async goNextStep(presetSlug: Presets) {
        const nextStep = this.findNextStepForPreset(presetSlug);

        if (!nextStep) {
            return;
        }

        await this.passStep(nextStep);
    }

    private async goPrevStep(presetSlug: Presets) {
        this.progressLoadedGuard();

        const preset = this.options.config.presets[presetSlug as Presets];

        if (!preset || preset.type === 'combined') {
            return;
        }

        const presetSteps = preset.steps.map((step) => step.slug);
        const passedSteps = this.state.progress.presetPassedSteps[presetSlug] ?? [];
        const skippedSteps = this.state.progress.presetSkippedSteps?.[presetSlug] ?? [];
        const hasSkippedSteps = presetSteps.some((step) => skippedSteps.includes(step));
        let lastPassedStep: string | undefined = passedSteps[passedSteps.length - 1];

        if (hasSkippedSteps) {
            const nextStep = this.findNextStepForPreset(presetSlug);
            const nextIndex = nextStep ? presetSteps.indexOf(nextStep) : presetSteps.length;
            lastPassedStep = presetSteps
                .slice(0, nextIndex)
                .reverse()
                .find((step) => passedSteps.includes(step));
        }

        const lastPassedStepIndex = presetSteps.findIndex((step) => step === lastPassedStep);

        if (lastPassedStepIndex === -1) {
            return;
        }
        this.state.progress.presetPassedSteps[presetSlug] = hasSkippedSteps
            ? passedSteps.filter((step) => step !== lastPassedStep)
            : presetSteps.slice(0, lastPassedStepIndex);

        this.closeHint();
        this.closedHints.delete(lastPassedStep as Steps);
        this.checkReachedHints();
        await this.updateProgress();
    }
}
