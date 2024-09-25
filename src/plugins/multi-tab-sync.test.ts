import {getAnchorElement, getOptions} from '../tests/utils';
import {Controller} from '../controller';
import {MultiTabSyncPlugin} from './multi-tab-sync';

beforeEach(() => {
    window.localStorage.clear();
});

describe('close hint sync', function () {
    describe('send event', function () {
        it('change ls on hint close', async function () {
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
    });
});

describe('state sync', function () {
    describe('send event', function () {
        it('change ls on state change', async function () {
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

        it('disabled state sync -> NOT change ls on hint close', async function () {
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
    });
});

describe('local storage errors', function () {
    afterAll(() => {
        jest.clearAllMocks();
    });

    it('got quota error -> dont write again', async function () {
        jest.spyOn(Storage.prototype, 'setItem');
        Storage.prototype.setItem = jest.fn(() => {
            throw new DOMException('', 'QuotaExceededError');
        });

        const options = getOptions();
        options.plugins = [new MultiTabSyncPlugin({__unstable_enableStateSync: true})];

        const controller = new Controller(options);
        await controller.setWizardState('collapsed');
        await controller.setWizardState('visible');

        expect(Storage.prototype.setItem).toHaveBeenCalledTimes(1);
    });
});
