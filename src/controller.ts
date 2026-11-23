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
    ProgressState,
    ReachElementParams,
    ResolvedOptions,
    RunPresetOptions,
    UserPreset,
} from './types';
import {HintStore} from './hints/hintStore';
import {Logger, createLogger} from './logger';
import {createDebounceHandler} from './debounce';
import {EventEmitter} from './event-emitter';

type Listener = () => void;

type TemporaryPresetRun<Steps extends string> = {
    passedSteps: Steps[];
    detachAbort?: () => void;
};

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
    private temporaryRuns = new Map<Presets, TemporaryPresetRun<Steps>>();
    private presetRunSequence = 0;
    private temporaryRunRequests = new Map<Presets, number>();
    private temporaryResets = new Map<Presets, Promise<boolean>>();
    private temporaryTerminalEvents = new Map<Presets, Promise<boolean>>();

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
            base: {...this.fulfillUserBaseState(options.baseState ?? {})},
        };
        this.discardStoredTemporaryState();

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

        const temporaryRun = this.temporaryRuns.get(preset);

        await this.ensureRunning();

        if (temporaryRun && this.temporaryRuns.get(preset) !== temporaryRun) {
            return;
        }

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

        await this.savePassedStepData(preset, stepSlug, () => {
            step?.hooks?.onStepPass?.();
            this.events.emit('stepPass', {preset, step: stepSlug});

            if (
                step?.passMode !== 'onShowHint' &&
                (!temporaryRun || this.hintStore.state.hint?.preset === preset)
            ) {
                this.logger.debug('Close hint on step', stepSlug);
                this.closeHintByUser(undefined, 'stepPassed');
                this.checkReachedHints();
            }
        });
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
        const temporaryRun = this.temporaryRuns.get(preset);

        const shouldProcessAppearance = await this.events.emit('stepElementReached', {stepData});

        if (shouldProcessAppearance && this.temporaryRuns.get(preset) === temporaryRun) {
            await this.processElementAppearance(stepData);
        } else {
            this.logger.debug('Reject process appearance', stepSlug);
        }
    };

    processElementAppearance = async (stepData: ReachElementParams<Presets, Steps>) => {
        const {preset, element, stepSlug} = stepData;
        const temporaryRun = this.temporaryRuns.get(preset);
        const isCurrentRun = temporaryRun
            ? () => this.temporaryRuns.get(preset) === temporaryRun
            : undefined;

        if (this.isTemporaryPreset(preset) && !temporaryRun) {
            return;
        }

        if (!this.state.base.enabled) {
            this.logger.debug('Onboarding is not enabled', preset, stepSlug);
            return;
        }

        await this.ensureRunning();
        this.progressLoadedGuard();

        if (isCurrentRun?.() === false) {
            return;
        }

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

        const allowRun = await this.events.emit(
            'beforeShowHint',
            isCurrentRun ? {stepData, isCurrentRun} : {stepData},
        );

        if (isCurrentRun?.() === false) {
            return;
        }

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

        this.logger.debug(`Display hint for step ${stepSlug}`);
        this.events.emit('showHint', {preset, step: stepSlug});

        this.options.showHint?.({preset, element: currentElement, step});

        if (isCurrentRun?.() === false) {
            return;
        }

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
        ).filter((preset) => !this.isTemporaryPreset(preset));
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

        if (this.isTemporaryPreset(preset)) {
            return false;
        }

        const allowRun = await this.events.emit('beforeSuggestPreset', {preset});

        if (!allowRun) {
            this.logger.debug('Preset suggestion cancelled', preset);
            return false;
        }

        return this.startPreset(preset, false);
    };

    runPreset = (preset: string, {signal}: RunPresetOptions = {}) =>
        this.startPreset(preset, true, signal);

    finishPreset = async (presetToFinish: Presets, shouldSave = true) => {
        if (this.status === 'disabled') {
            return false;
        }

        await this.ensurePresetsLoaded();

        // take normal or find internal
        const presetSlug = this.resolvePresetSlug(presetToFinish);
        if (!presetSlug) {
            return false;
        }

        const temporaryRun = this.temporaryRuns.get(presetSlug);

        await this.ensureRunning();
        this.progressLoadedGuard();

        if (this.state.progress.finishedPresets.includes(presetSlug)) {
            this.logger.debug('Preset already finished', presetToFinish);
            return true;
        }

        if (
            this.isTemporaryPreset(presetSlug) &&
            (!temporaryRun || this.temporaryRuns.get(presetSlug) !== temporaryRun)
        ) {
            return false;
        }

        this.logger.debug('Preset finished', presetToFinish);

        if (temporaryRun) {
            this.state.progress.finishedPresets.push(presetSlug);
            this.completeTemporaryRun(presetSlug, temporaryRun, !shouldSave);
        } else {
            this.events.emit('finishPreset', {preset: presetSlug});
        }

        this.options.config.presets[presetToFinish]?.hooks?.onEnd?.();

        if (presetSlug !== presetToFinish) {
            this.options.config.presets[presetSlug].hooks?.onEnd?.();
        }

        if (!temporaryRun) {
            this.state.base.activePresets = this.state.base.activePresets.filter(
                (activePresetSlug) => activePresetSlug !== presetSlug,
            );
            this.state.progress.finishedPresets?.push(presetSlug);
        }

        if (shouldSave) {
            if (!temporaryRun) {
                await this.updateBaseState();
            }

            await this.updateProgress();
        }

        return true;
    };

    resetPresetProgress = async (
        presetArg: string | string[],
        {removeFromSuggested} = {removeFromSuggested: false},
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

        await this.resetResolvedPresetsProgress(presets, {removeFromSuggested});
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
            this.initProgressState(await this.progressLoadingPromise);
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
        for (const [preset, run] of this.temporaryRuns) {
            this.cancelTemporaryRun(preset, run);
        }

        this.state = {
            base: this.fulfillUserBaseState({}),
            progress: getDefaultProgressState(),
        };

        await this.updateBaseState();
        await this.updateProgress();
    }

    closeHint = (stepSlug?: Steps, eventSource: HintCloseSource = 'externalEvent') => {
        const currentHintStep = this.hintStore.state.hint?.step.slug;
        this.logger.debug('Close hint(internal)', currentHintStep);
        if (stepSlug && stepSlug !== currentHintStep) {
            this.logger.debug('Hint for step', stepSlug, 'is not current hint');
            return;
        }

        if (currentHintStep) {
            const step = this.getStepBySlug(currentHintStep);
            step?.hooks?.onCloseHint?.({eventSource});
        }

        this.hintStore.closeHint(eventSource);
    };

    emitStateChange = () => {
        this.state = JSON.parse(JSON.stringify(this.state));
        this.discardStoredTemporaryState();

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

    private async startPreset(
        presetToRunSlug: string,
        allowTemporary: boolean,
        signal?: AbortSignal,
    ) {
        if (this.status === 'disabled') {
            return false;
        }

        const request = ++this.presetRunSequence;

        await this.ensurePresetsLoaded();

        if (!this.presetExistsGuard(presetToRunSlug)) {
            return false;
        }

        const presetToRun = this.options.config.presets[presetToRunSlug];
        const presetSlug = (
            presetToRun.type === 'combined' ? await presetToRun.pickPreset() : presetToRunSlug
        ) as Presets;
        const temporary = this.isTemporaryPreset(presetSlug);
        const canStart = temporary
            ? await this.prepareTemporaryRunRequest(presetSlug, request, allowTemporary, signal)
            : () => true;

        if (!canStart || !canStart()) {
            return false;
        }

        this.logger.debug('Running preset', presetSlug);

        await presetToRun.hooks?.onBeforeStart?.();

        if (!canStart()) {
            return false;
        }

        if (presetSlug !== presetToRunSlug) {
            await this.options.config.presets[presetSlug].hooks?.onBeforeStart?.();
        }

        if (!canStart()) {
            return false;
        }

        await this.events.emit('beforeRunPreset', {preset: presetSlug});

        if (temporary) {
            if (!(await this.resetTemporaryPreset(presetSlug, canStart)) || !canStart()) {
                return false;
            }

            this.startTemporaryRun(presetSlug, signal);
        } else {
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
        }

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

        if (temporary) {
            this.emitStateChange();
        } else {
            await this.updateBaseState();
        }

        this.logger.debug('Preset ran', presetSlug);

        return true;
    }

    private async prepareTemporaryRunRequest(
        preset: Presets,
        request: number,
        allowTemporary: boolean,
        signal?: AbortSignal,
    ) {
        if (
            !allowTemporary ||
            signal?.aborted ||
            request < (this.temporaryRunRequests.get(preset) ?? 0)
        ) {
            return undefined;
        }

        this.temporaryRunRequests.set(preset, request);
        await this.ensureRunning();
        this.progressLoadedGuard();

        const isCurrent = () =>
            !signal?.aborted && this.temporaryRunRequests.get(preset) === request;

        return isCurrent() ? isCurrent : undefined;
    }

    private async resetTemporaryPreset(preset: Presets, isCurrent: () => boolean) {
        await this.temporaryResets.get(preset)?.catch(() => undefined);
        let terminal = this.temporaryTerminalEvents.get(preset);

        while (terminal) {
            await terminal.catch(() => undefined);
            terminal = this.temporaryTerminalEvents.get(preset);
        }

        if (!isCurrent()) {
            return false;
        }

        const reset = this.resetResolvedPresetsProgress([preset], {
            waitForListeners: true,
            isCurrent,
        });

        this.temporaryResets.set(preset, reset);

        try {
            return (await reset) && isCurrent();
        } finally {
            if (this.temporaryResets.get(preset) === reset) {
                this.temporaryResets.delete(preset);
            }
        }
    }

    private async resetResolvedPresetsProgress(
        presets: Presets[],
        {
            removeFromSuggested = false,
            waitForListeners = false,
            isCurrent,
        }: {
            removeFromSuggested?: boolean;
            waitForListeners?: boolean;
            isCurrent?: () => boolean;
        } = {},
    ) {
        this.progressLoadedGuard();

        if (isCurrent?.() === false) {
            return false;
        }

        this.state.progress.finishedPresets = this.state.progress.finishedPresets.filter(
            (preset) => !presets.includes(preset as Presets),
        );

        for (const preset of presets) {
            delete this.state.progress.presetPassedSteps[preset];
            const run = this.temporaryRuns.get(preset);

            if (run) {
                const cancellation = this.cancelTemporaryRun(preset, run);

                if (waitForListeners) await cancellation;
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

        const reset = this.events.emit('resetPresetProgress', {presets});

        if (waitForListeners) await reset;

        await this.updateBaseState();
        await this.updateProgress();

        return true;
    }

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

        const activeInternalPreset = [
            ...this.state.base.activePresets,
            ...this.temporaryRuns.keys(),
        ].find((slug) => preset.internalPresets.includes(slug)) as Presets | undefined;

        const finishedInternalPreset = this.state.progress?.finishedPresets.find((finishedPreset) =>
            preset.internalPresets.includes(finishedPreset),
        ) as Presets | undefined;

        return activeInternalPreset || finishedInternalPreset;
    };

    private filterExistedPresets = (presets: string[]) => {
        // @ts-ignore
        return presets.filter((slug) => Boolean(this.options.config.presets[slug])) as Presets[];
    };

    private isTemporaryPreset(preset: string) {
        const config = this.options.config.presets[preset as Presets];

        return config?.type !== 'combined' && config?.persistence === 'temporary';
    }

    private isActivePreset(preset: Presets) {
        return this.isTemporaryPreset(preset)
            ? this.temporaryRuns.has(preset)
            : this.state.base.activePresets.includes(preset);
    }

    private startTemporaryRun(preset: Presets, signal?: AbortSignal) {
        const run: TemporaryPresetRun<Steps> = {passedSteps: []};

        this.temporaryRuns.set(preset, run);

        if (signal) {
            const abort = () => {
                this.cancelTemporaryRun(preset, run).catch((error) => this.logger.error(error));
            };

            signal.addEventListener('abort', abort, {once: true});
            run.detachAbort = () => signal.removeEventListener('abort', abort);
        }
    }

    private removeTemporaryRun(preset: Presets, run: TemporaryPresetRun<Steps>) {
        if (this.temporaryRuns.get(preset) !== run) {
            return false;
        }

        this.temporaryRuns.delete(preset);
        run.detachAbort?.();

        return true;
    }

    private completeTemporaryRun(
        preset: Presets,
        run: TemporaryPresetRun<Steps>,
        autoPassed: boolean,
    ) {
        const finish = () => {
            if (this.removeTemporaryRun(preset, run)) {
                this.emitTemporaryTerminalEvent(preset, 'finishPreset');
                this.checkReachedHints();
            }
        };
        const {hint} = this.hintStore.state;

        if (autoPassed && hint?.preset === preset && hint.step.passMode === 'onShowHint') {
            const onHide = ({state}: EventsMap['hintDataChanged']) => {
                if (state.hint?.preset !== preset) {
                    finish();
                }
            };
            const detachAbort = run.detachAbort;

            this.events.subscribe('hintDataChanged', onHide);
            run.detachAbort = () => {
                detachAbort?.();
                this.events.unsubscribe('hintDataChanged', onHide);
            };
            return;
        }

        if (hint?.preset === preset) {
            this.closeHint(undefined, 'interrupted');
        }

        finish();
    }

    private cancelTemporaryRun(preset: Presets, run: TemporaryPresetRun<Steps>) {
        if (!this.removeTemporaryRun(preset, run)) {
            return Promise.resolve(false);
        }

        if (this.hintStore.state.open && this.hintStore.state.hint?.preset === preset) {
            this.closeHint(undefined, 'interrupted');
        }

        const event = this.emitTemporaryTerminalEvent(
            preset,
            this.state.progress?.finishedPresets.includes(preset)
                ? 'finishPreset'
                : 'cancelTemporaryPreset',
        );

        this.emitStateChange();
        this.checkReachedHints();

        return event;
    }

    private emitTemporaryTerminalEvent(
        preset: Presets,
        type: 'finishPreset' | 'cancelTemporaryPreset',
    ) {
        const event = this.events.emit(type, {preset});
        const cleanup = () => {
            if (this.temporaryTerminalEvents.get(preset) === event) {
                this.temporaryTerminalEvents.delete(preset);
            }
        };

        this.temporaryTerminalEvents.set(preset, event);
        event.then(cleanup, (error) => {
            cleanup();
            this.logger.error(error);
        });

        return event;
    }

    private discardStoredTemporaryState() {
        const {base, progress} = this.state;
        const isPersistent = (preset: string) => !this.isTemporaryPreset(preset);

        for (const field of ['availablePresets', 'activePresets', 'suggestedPresets'] as const) {
            base[field] = base[field].filter(isPersistent);
        }

        if (progress) {
            for (const preset of Object.keys(progress.presetPassedSteps)) {
                if (!isPersistent(preset)) {
                    delete progress.presetPassedSteps[preset];
                }
            }
        }
    }

    private isVisiblePreset = (presetSlug: string) => {
        if (!this.checkPresetExists(presetSlug)) {
            return false;
        }

        const preset = this.options.config.presets[presetSlug as Presets];

        if (preset.type === 'internal' || this.isTemporaryPreset(presetSlug)) {
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
        const passedSteps = this.getPassedSteps(presetSlug);

        if (!presetSteps || !passedSteps) {
            this.logger.debug('Unknown preset', preset);
            return undefined;
        }

        return Controller.findNextUnpassedStep(presetSteps, passedSteps) as Steps;
    }

    private findActivePresetWithStep(stepSlug: Steps) {
        const presets = this.findPresetsWithStep(stepSlug).filter((presetName) =>
            this.isActivePreset(presetName),
        );

        if (presets.length > 1) {
            this.logger.error('More than 1 active preset for step', stepSlug);
        }

        return presets[0];
    }

    private findAvailablePresetWithStep(stepSlug: Steps) {
        const presets = this.findPresetsWithStep(stepSlug).filter((presetName) =>
            this.isTemporaryPreset(presetName)
                ? this.temporaryRuns.has(presetName)
                : this.state.base.availablePresets.includes(presetName),
        );

        let targetPreset = presets[0];
        if (presets.length > 1) {
            this.logger.error('More than 1 available preset for step', stepSlug, presets);
            const activePreset = presets.find((presetName) => this.isActivePreset(presetName));

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

    private getPassedSteps(preset: Presets) {
        return (
            this.temporaryRuns.get(preset)?.passedSteps ??
            this.state.progress?.presetPassedSteps[preset] ??
            []
        );
    }

    private async savePassedStepData(preset: Presets, step: Steps, callback?: () => void) {
        this.logger.debug('Save passed step data', preset, step);

        this.progressLoadedGuard();

        const temporaryRun = this.temporaryRuns.get(preset);
        const passedSteps = this.getPassedSteps(preset);

        if (passedSteps.includes(step)) {
            this.logger.debug('Step already passed', preset, step);
            return;
        }

        if (temporaryRun) {
            temporaryRun.passedSteps.push(step);
        } else {
            this.state.progress.presetPassedSteps[preset] = [...passedSteps, step];
        }

        // eslint-disable-next-line callback-return
        callback?.();

        const finished = await this.checkAndProcessPresetFinish(preset);

        if (!temporaryRun || finished) {
            await this.updateProgress();
        } else {
            this.emitStateChange();
        }
    }

    private async checkAndProcessPresetFinish(presetSlug: Presets) {
        this.progressLoadedGuard();
        const preset = this.options.config.presets[presetSlug];

        if (!preset || preset.type === 'combined') {
            // no combined presets here
            return false;
        }

        const lastStepSlug = preset.steps[preset.steps.length - 1].slug;
        if (!this.getPassedSteps(presetSlug).includes(lastStepSlug)) {
            return false;
        }

        const finished = await this.finishPreset(presetSlug, false);

        if (!this.isTemporaryPreset(presetSlug)) {
            await this.updateBaseState();
        }

        return finished;
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

        const temporaryRun = this.temporaryRuns.get(presetSlug);

        if (this.isTemporaryPreset(presetSlug) && !temporaryRun) {
            return;
        }

        const presetSteps = preset.steps.map((step) => step.slug);
        const passedSteps = this.getPassedSteps(presetSlug);

        const lastPassedStep = passedSteps[passedSteps.length - 1];
        const lastPassedStepIndex = presetSteps.indexOf(lastPassedStep as Steps);

        if (lastPassedStepIndex === -1) {
            return;
        }
        const previousSteps = presetSteps.slice(0, lastPassedStepIndex);

        if (temporaryRun) {
            temporaryRun.passedSteps = previousSteps;
        } else {
            this.state.progress.presetPassedSteps[presetSlug] = previousSteps;
        }

        if (!temporaryRun || this.hintStore.state.hint?.preset === presetSlug) {
            this.closeHint();
        }

        this.closedHints.delete(lastPassedStep as Steps);
        this.checkReachedHints();

        if (temporaryRun) {
            this.emitStateChange();
        } else {
            await this.updateProgress();
        }
    }
}
