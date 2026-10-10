import {getAnchorElement, getOptions, getSameStepsOptions} from '../tests/utils';
import {Controller} from '../controller';
import {MultiTabSyncPlugin} from './multi-tab-sync';

beforeEach(() => {
    window.localStorage.clear();
});

describe('init', function () {
    it('constructor with custom options -> set custom options', () => {
        const customOptions = {
            changeStateLSKey: 'custom.changeState',
            closeHintLSKey: 'custom.closeHint',
            skipStepLSKey: 'custom.skipStep',
            enableCloseHintSync: false,
            __unstable_enableStateSync: true,
        };

        const plugin = new MultiTabSyncPlugin(customOptions);

        expect(plugin.options.changeStateLSKey).toBe('custom.changeState');
        expect(plugin.options.closeHintLSKey).toBe('custom.closeHint');
        expect(plugin.options.skipStepLSKey).toBe('custom.skipStep');
        expect(plugin.options.enableCloseHintSync).toBe(false);
        expect(plugin.options.__unstable_enableStateSync).toBe(true);
    });

    it('constructor with no options -> set default options', () => {
        const plugin = new MultiTabSyncPlugin();

        expect(plugin.options.changeStateLSKey).toBe('onboarding.plugin-sync.changeState');
        expect(plugin.options.closeHintLSKey).toBe('onboarding.plugin-sync.closeHint');
        expect(plugin.options.skipStepLSKey).toBe('onboarding.plugin-sync.skipStep');
        expect(plugin.options.enableCloseHintSync).toBe(true);
        expect(plugin.options.__unstable_enableStateSync).toBe(false);
        expect(plugin.isQuotaExceeded).toBe(false);
    });
});

describe('close hint sync', function () {
    it('sends scoped skipped progress and preserves the legacy close format', async function () {
        const options = getOptions();
        options.plugins = [new MultiTabSyncPlugin()];
        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'createSprint',
            element: getAnchorElement(),
        });

        await controller.skipStep('createSprint');

        expect(JSON.parse(localStorage.getItem('onboarding.plugin-sync.skipStep') ?? '')).toEqual(
            expect.objectContaining({
                preset: 'createProject',
                step: 'createSprint',
                passedSteps: ['openBoard'],
                skippedSteps: ['createSprint'],
                closeHint: true,
            }),
        );
        expect(localStorage.getItem('onboarding.plugin-sync.closeHint')).toBe('createSprint');
    });

    it('suppresses the legacy close paired with a scoped skip', async function () {
        const options = getOptions();
        const plugin = new MultiTabSyncPlugin();
        options.plugins = [plugin];
        const onUserClose = vi.fn();
        const onClose = vi.fn();
        options.config.presets.createProject.steps[1].hooks = {
            onCloseHintByUser: onUserClose,
            onCloseHint: onClose,
        };
        const controller = new Controller(options);
        await controller.stepElementReached({
            stepSlug: 'createSprint',
            element: getAnchorElement(),
        });

        const syncing = plugin.handleLSEvent(
            new StorageEvent('storage', {
                key: plugin.options.skipStepLSKey,
                newValue: JSON.stringify({
                    preset: 'createProject',
                    step: 'createSprint',
                    skippedSteps: ['createSprint'],
                    passedSteps: ['openBoard'],
                    closeHint: true,
                }),
            }),
        );
        plugin.handleLSEvent(
            new StorageEvent('storage', {
                key: plugin.options.closeHintLSKey,
                newValue: 'createSprint',
            }),
        );
        await syncing;

        expect(controller.hintStore.state.open).toBe(false);
        expect(onClose).toHaveBeenCalledWith({eventSource: 'stepSkipped'});
        expect(onUserClose).not.toHaveBeenCalled();
    });

    describe('send event', function () {
        it('hint closed by user -> change ls', async function () {
            const options = getOptions();
            options.plugins = [new MultiTabSyncPlugin()];

            const controller = new Controller(options);
            await controller.stepElementReached({
                stepSlug: 'createSprint',
                element: getAnchorElement(),
            });

            controller.closeHintByUser();

            expect(localStorage.getItem('onboarding.plugin-sync.closeHint')).toBe('createSprint');
        });

        it('custom LS key -> change ls on hint close', async function () {
            const options = getOptions();
            options.plugins = [
                new MultiTabSyncPlugin({
                    closeHintLSKey: 'someKey',
                }),
            ];

            const controller = new Controller(options);
            await controller.stepElementReached({
                stepSlug: 'createSprint',
                element: getAnchorElement(),
            });

            controller.closeHintByUser();

            expect(localStorage.getItem('someKey')).toBe('createSprint');
        });

        it('disabled hint sync -> NOT change ls on hint close', async function () {
            const options = getOptions();
            options.plugins = [
                new MultiTabSyncPlugin({
                    enableCloseHintSync: false,
                }),
            ];

            const controller = new Controller(options);
            await controller.stepElementReached({
                stepSlug: 'createSprint',
                element: getAnchorElement(),
            });

            controller.closeHintByUser();

            expect(localStorage.getItem('onboarding.plugin-sync.closeHint')).not.toBe(
                'createSprint',
            );
        });
    });

    describe('receive event', function () {
        it('get close hint LS event -> close hint', async function () {
            const options = getOptions();
            options.plugins = [new MultiTabSyncPlugin()];

            const controller = new Controller(options);
            await controller.stepElementReached({
                stepSlug: 'createSprint',
                element: getAnchorElement(),
            });

            window.dispatchEvent(
                new StorageEvent('storage', {
                    key: 'onboarding.plugin-sync.closeHint',
                    newValue: 'createSprint',
                }),
            );

            const snapshot = controller.hintStore.getSnapshot();
            expect(snapshot.open).toBe(false);
        });

        it('get close hint event with custom key -> close hint', async function () {
            const options = getOptions();
            options.plugins = [
                new MultiTabSyncPlugin({
                    closeHintLSKey: 'somekey2',
                }),
            ];

            const controller = new Controller(options);
            await controller.stepElementReached({
                stepSlug: 'createSprint',
                element: getAnchorElement(),
            });

            window.dispatchEvent(
                new StorageEvent('storage', {
                    key: 'somekey2',
                    newValue: 'createSprint',
                }),
            );

            const snapshot = controller.hintStore.getSnapshot();
            expect(snapshot.open).toBe(false);
        });

        it('disabled hint sync -> NOT close hint', async function () {
            const options = getOptions();
            options.plugins = [
                new MultiTabSyncPlugin({
                    enableCloseHintSync: false,
                }),
            ];

            const controller = new Controller(options);
            await controller.stepElementReached({
                stepSlug: 'createSprint',
                element: getAnchorElement(),
            });

            window.dispatchEvent(
                new StorageEvent('storage', {
                    key: 'onboarding.plugin-sync.closeHint',
                    newValue: 'createSprint',
                }),
            );

            const snapshot = controller.hintStore.getSnapshot();
            expect(snapshot.open).toBe(true);
        });

        it('handleLSEvent with undefined onboardingInstance -> return undefined', () => {
            const plugin = new MultiTabSyncPlugin();
            const event = new StorageEvent('storage', {
                key: 'test',
                newValue: 'test',
            });

            expect(plugin.handleLSEvent(event)).toBeUndefined();
        });
    });
});

describe('skipped progress sync', () => {
    const skipEvent = (plugin: MultiTabSyncPlugin, payload: object) =>
        new StorageEvent('storage', {
            key: plugin.options.skipStepLSKey,
            newValue: JSON.stringify(payload),
        });

    it('broadcasts skips before a hint and varies payloads after a reset', async () => {
        const plugin = new MultiTabSyncPlugin({closeHintLSKey: 'custom.close'});
        const options = getOptions({}, {presetPassedSteps: {}});
        options.plugins = [plugin];
        const controller = new Controller(options);
        await controller.skipStep('openBoard');
        const first = localStorage.getItem('custom.close.skipStep');
        expect(JSON.parse(first ?? '')).toEqual(
            expect.objectContaining({
                preset: 'createProject',
                step: 'openBoard',
                skippedSteps: ['openBoard'],
                closeHint: false,
            }),
        );
        expect(localStorage.getItem(plugin.options.closeHintLSKey)).toBeNull();

        await controller.resetPresetProgress('createProject');
        await controller.skipStep('openBoard');
        expect(localStorage.getItem('custom.close.skipStep')).not.toBe(first);
    });

    it('merges overlapping mixed snapshots without echoing a delayed skip', async () => {
        const plugin = new MultiTabSyncPlugin();
        const options = getOptions({}, {presetPassedSteps: {}});
        options.plugins = [plugin];
        let releaseHook!: () => void;
        let notifyHookStarted!: () => void;
        const hookPermission = new Promise<void>((resolve) => {
            releaseHook = resolve;
        });
        const hookStarted = new Promise<void>((resolve) => {
            notifyHookStarted = resolve;
        });
        const slowHook = vi.fn(async () => {
            notifyHookStarted();
            await hookPermission;
        });
        options.config.presets.createProject.steps[0].hooks = {onStepSkip: slowHook};
        const controller = new Controller(options);
        const finish = vi.fn();
        controller.events.subscribe('finishPreset', finish);
        const first = plugin.handleLSEvent(
            skipEvent(plugin, {
                preset: 'createProject',
                step: 'openBoard',
                passedSteps: ['createSprint'],
                skippedSteps: ['openBoard'],
            }),
        );
        await hookStarted;

        const overlapping = skipEvent(plugin, {
            preset: 'createProject',
            step: 'createIssue',
            passedSteps: ['createSprint'],
            skippedSteps: ['openBoard', 'createIssue'],
        });
        await plugin.handleLSEvent(overlapping);

        expect(localStorage.getItem(plugin.options.skipStepLSKey)).toBeNull();
        expect(localStorage.getItem(plugin.options.closeHintLSKey)).toBeNull();

        releaseHook();
        await first;
        await plugin.handleLSEvent(overlapping);

        expect(slowHook).toHaveBeenCalledOnce();
        expect(controller.state.progress?.presetPassedSteps.createProject).toEqual([
            'createSprint',
        ]);
        expect(controller.state.progress?.presetSkippedSteps?.createProject).toEqual([
            'openBoard',
            'createIssue',
        ]);
        expect(finish).toHaveBeenCalledOnce();
        expect(localStorage.getItem(plugin.options.skipStepLSKey)).toBeNull();
        expect(localStorage.getItem(plugin.options.closeHintLSKey)).toBeNull();
    });

    it('scopes remote skips and legacy closes when two presets share a slug', async () => {
        const plugin = new MultiTabSyncPlugin();
        const options = getSameStepsOptions({
            availablePresets: ['preset1', 'preset2'],
            activePresets: ['preset2'],
        });
        options.plugins = [plugin];
        const controller = new Controller(options);
        await controller.stepElementReached({stepSlug: 'step1', element: getAnchorElement()});
        const syncing = plugin.handleLSEvent(
            skipEvent(plugin, {preset: 'preset1', step: 'step1', closeHint: true}),
        );
        plugin.handleLSEvent(
            new StorageEvent('storage', {
                key: plugin.options.closeHintLSKey,
                newValue: 'step1',
            }),
        );
        await syncing;

        expect(controller.state.progress?.presetSkippedSteps).toEqual({preset1: ['step1']});
        expect(controller.hintStore.state.hint?.preset).toBe('preset2');
        expect(controller.hintStore.state.open).toBe(true);
    });

    it('does not synchronize skips when hint sync is disabled', async () => {
        const plugin = new MultiTabSyncPlugin({enableCloseHintSync: false});
        const options = getOptions({}, {presetPassedSteps: {}});
        options.plugins = [plugin];
        const controller = new Controller(options);
        await controller.skipStep('openBoard');
        expect(localStorage.getItem(plugin.options.skipStepLSKey)).toBeNull();
        await plugin.handleLSEvent(
            skipEvent(plugin, {preset: 'createProject', step: 'createSprint'}),
        );
        expect(controller.state.progress?.presetSkippedSteps?.createProject).toEqual(['openBoard']);
    });

    it.each(['broken-json', 'null', '{"preset":1,"step":"openBoard"}'])(
        'ignores invalid skip messages: %s',
        async (newValue) => {
            const plugin = new MultiTabSyncPlugin();
            const options = getOptions();
            options.plugins = [plugin];
            const controller = new Controller(options);
            await plugin.handleLSEvent(
                new StorageEvent('storage', {key: plugin.options.skipStepLSKey, newValue}),
            );
            expect(controller.state.progress).toBeUndefined();
        },
    );
});

describe('state sync', function () {
    describe('send event', function () {
        it('state changed -> change ls', async function () {
            const options = getOptions();
            options.plugins = [new MultiTabSyncPlugin({__unstable_enableStateSync: true})];

            const controller = new Controller(options);
            await controller.runPreset('createQueue');

            const newStateFromLS =
                localStorage.getItem('onboarding.plugin-sync.changeState') ?? '{}';
            expect(JSON.parse(newStateFromLS).base.activePresets).toContain('createQueue');
        });

        it('custom LS key -> change ls on state change', async function () {
            const options = getOptions();
            options.plugins = [
                new MultiTabSyncPlugin({
                    changeStateLSKey: 'somekey3',
                    __unstable_enableStateSync: true,
                }),
            ];

            const controller = new Controller(options);
            await controller.runPreset('createQueue');

            const newStateFromLS = localStorage.getItem('somekey3') ?? '{}';
            expect(JSON.parse(newStateFromLS).base.activePresets).toContain('createQueue');
        });

        it('disabled state sync -> NOT change ls on state change', async function () {
            const options = getOptions();
            options.plugins = [
                new MultiTabSyncPlugin({
                    __unstable_enableStateSync: false,
                }),
            ];

            const controller = new Controller(options);
            await controller.runPreset('createQueue');

            const newStateFromLS = localStorage.getItem('onboarding.plugin-sync.changeState');
            expect(newStateFromLS).toBeNull();
        });
    });

    describe('receive event', function () {
        it('get state LS event -> apply new state', async function () {
            const options = getOptions();
            options.plugins = [new MultiTabSyncPlugin({__unstable_enableStateSync: true})];

            const controller = new Controller(options);

            const newState = JSON.parse(JSON.stringify(controller.state));
            newState.base.activePresets.push('createQueue');

            window.dispatchEvent(
                new StorageEvent('storage', {
                    key: 'onboarding.plugin-sync.changeState',
                    newValue: JSON.stringify(newState),
                }),
            );

            expect(controller.state.base.activePresets).toContain('createQueue');
        });

        it('get state event with custom key -> apply new state', async function () {
            const options = getOptions();
            options.plugins = [
                new MultiTabSyncPlugin({
                    changeStateLSKey: 'somekey4',
                    __unstable_enableStateSync: true,
                }),
            ];

            const controller = new Controller(options);

            const newState = JSON.parse(JSON.stringify(controller.state));
            newState.base.activePresets.push('createQueue');

            window.dispatchEvent(
                new StorageEvent('storage', {
                    key: 'somekey4',
                    newValue: JSON.stringify(newState),
                }),
            );

            expect(controller.state.base.activePresets).toContain('createQueue');
        });

        it('disabled state sync -> NOT apply new state', async function () {
            const options = getOptions();
            options.plugins = [
                new MultiTabSyncPlugin({
                    __unstable_enableStateSync: false,
                }),
            ];

            const controller = new Controller(options);

            const newState = JSON.parse(JSON.stringify(controller.state));
            newState.base.activePresets.push('createQueue');

            window.dispatchEvent(
                new StorageEvent('storage', {
                    key: 'onboarding.plugin-sync.changeState',
                    newValue: JSON.stringify(newState),
                }),
            );

            expect(controller.state.base.activePresets).not.toContain('createQueue');
        });

        it('get event with non-matching key -> NOT change state', () => {
            const options = getOptions();
            const plugin = new MultiTabSyncPlugin({__unstable_enableStateSync: true});
            const controller = new Controller(options);

            plugin.onboardingInstance = controller;
            const originalState = controller.state;

            const event = new StorageEvent('storage', {
                key: 'different.key',
                newValue: '{"test": "data"}',
            });

            plugin.handleLSEvent(event);

            // State should not change for non-matching keys
            expect(controller.state).toBe(originalState);
        });

        it('localStorage event with null newValue -> NOT change state', () => {
            const options = getOptions();
            const plugin = new MultiTabSyncPlugin({__unstable_enableStateSync: true});
            const controller = new Controller(options);

            plugin.onboardingInstance = controller;
            const originalState = controller.state;

            const event = new StorageEvent('storage', {
                key: 'onboarding.plugin-sync.changeState',
                newValue: null,
            });

            plugin.handleLSEvent(event);

            // State should not change when newValue is null
            expect(controller.state).toBe(originalState);
        });
    });
});

describe('local storage errors', function () {
    afterAll(() => {
        vi.clearAllMocks();
    });

    it('quota exceeded error -> dont write again', async function () {
        vi.spyOn(Storage.prototype, 'setItem');
        Storage.prototype.setItem = vi.fn(() => {
            throw new DOMException('', 'QuotaExceededError');
        });

        const options = getOptions();
        options.plugins = [new MultiTabSyncPlugin({__unstable_enableStateSync: true})];

        const controller = new Controller(options);
        await controller.setWizardState('collapsed');
        await controller.setWizardState('visible');

        expect(Storage.prototype.setItem).toHaveBeenCalledTimes(1);
    });

    it('non-quota localStorage error -> NOT set quota exceeded flag', async () => {
        vi.spyOn(Storage.prototype, 'setItem');
        Storage.prototype.setItem = vi.fn(() => {
            throw new Error('Different localStorage error');
        });

        const options = getOptions();
        options.plugins = [new MultiTabSyncPlugin({__unstable_enableStateSync: true})];

        const controller = new Controller(options);
        await controller.setWizardState('collapsed');
        await controller.setWizardState('visible');

        expect(Storage.prototype.setItem).toHaveBeenCalledTimes(2);
    });
});
