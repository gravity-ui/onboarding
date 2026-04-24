import {Controller} from '../controller';
import {getOptions} from './utils';
import type {InitOptions} from '../types';

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const asyncPresetsMap = () => ({
    asyncA: {
        name: 'Async A',
        steps: [{slug: 'asyncAStep1', name: '', description: ''}],
    },
    asyncB: {
        name: 'Async B',
        steps: [{slug: 'asyncBStep1', name: '', description: ''}],
    },
});

const getAsyncOptions = () => {
    const base = getOptions();
    const loader = jest.fn(() => Promise.resolve(asyncPresetsMap()));
    const options = {
        ...base,
        config: {
            ...base.config,
            asyncPresets: loader,
        },
    } as unknown as InitOptions<any, any, any>;
    return {options, loader};
};

describe('async presets — loader invocation', () => {
    it('does NOT invoke loader when no preset-touching method is called', async () => {
        const {options, loader} = getAsyncOptions();
        // eslint-disable-next-line no-new
        new Controller(options);

        expect(loader).not.toHaveBeenCalled(); // synchronous check

        await flushPromises();

        expect(loader).not.toHaveBeenCalled(); // microtask check
    });

    it('invokes loader exactly once when runPreset is called multiple times', async () => {
        const {options, loader} = getAsyncOptions();
        const controller = new Controller(options);

        await controller.runPreset('asyncA');
        await controller.runPreset('asyncB');

        expect(loader).toHaveBeenCalledTimes(1);
    });

    it('shares in-flight promise across concurrent calls', async () => {
        const {options, loader} = getAsyncOptions();
        const controller = new Controller(options);

        await Promise.all([
            controller.runPreset('asyncA'),
            controller.runPreset('asyncB'),
            controller.addPreset('asyncA'),
        ]);

        expect(loader).toHaveBeenCalledTimes(1);
    });

    it('does NOT invoke loader when controller is disabled via globalSwitch', async () => {
        const {options, loader} = getAsyncOptions();
        const controller = new Controller({
            ...options,
            globalSwitch: 'off',
        } as any);

        await controller.runPreset('asyncA');
        await controller.addPreset('asyncB');
        await controller.suggestPresetOnce('asyncA');
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        controller.userPresets;

        expect(loader).not.toHaveBeenCalled();
    });
});

describe('async presets — step interactions', () => {
    it('passStep for a step from async preset awaits loader', async () => {
        const {options, loader} = getAsyncOptions();
        const controller = new Controller({
            ...options,
            baseState: {
                ...options.baseState,
                availablePresets: ['asyncA'],
                activePresets: ['asyncA'],
            },
        } as any);

        await controller.passStep('asyncAStep1' as any);

        expect(loader).toHaveBeenCalledTimes(1);
    });

    it('stepElementReached for a step from async preset awaits loader', async () => {
        const {options, loader} = getAsyncOptions();
        const controller = new Controller(options);
        const mockElement = document.createElement('div');

        await controller.stepElementReached({
            stepSlug: 'asyncAStep1' as any,
            element: mockElement,
        });

        expect(loader).toHaveBeenCalledTimes(1);
    });
});

describe('async presets — lifecycle methods', () => {
    it('finishPreset on async slug awaits loader', async () => {
        const {options, loader} = getAsyncOptions();
        const controller = new Controller(options);

        await controller.finishPreset('asyncA' as any);

        expect(loader).toHaveBeenCalledTimes(1);
    });

    it('resetPresetProgress on async slug awaits loader', async () => {
        const {options, loader} = getAsyncOptions();
        const controller = new Controller(options);

        await controller.resetPresetProgress('asyncA');

        expect(loader).toHaveBeenCalledTimes(1);
    });
});

describe('async presets — reactive userPresets', () => {
    it('userPresets getter triggers loader (fire-and-forget) and emits stateChange on resolve', async () => {
        const {options, loader} = getAsyncOptions();
        const controller = new Controller(options);
        const listener = jest.fn();
        controller.events.subscribe('stateChange', listener);

        const firstRead = controller.userPresets;
        expect(loader).toHaveBeenCalledTimes(1);
        expect(firstRead.some((p) => p.slug === 'asyncA')).toBe(false);

        await flushPromises();

        expect(listener).toHaveBeenCalled();

        const secondRead = controller.userPresets;
        expect(secondRead.some((p) => p.slug === 'asyncA')).toBe(true);
    });
});

describe('async presets — wizard prefetch', () => {
    it('setWizardState(visible) triggers loader fire-and-forget', async () => {
        const {options, loader} = getAsyncOptions();
        const controller = new Controller({
            ...options,
            baseState: {...options.baseState, wizardState: 'hidden'},
        } as any);

        await controller.setWizardState('visible');

        expect(loader).toHaveBeenCalledTimes(1);
    });
});

describe('async presets — error handling', () => {
    it('rejected loader is surfaced and cached — subsequent calls do not retry', async () => {
        const base = getOptions();
        const loader = jest.fn().mockRejectedValue(new Error('network'));
        const controller = new Controller({
            ...base,
            config: {...base.config, asyncPresets: loader},
        } as any);

        await expect(controller.runPreset('asyncA')).rejects.toThrow('network');
        await expect(controller.runPreset('asyncA')).rejects.toThrow('network');
        await expect(controller.addPreset('asyncA')).rejects.toThrow('network');

        expect(loader).toHaveBeenCalledTimes(1);
    });

    it('does not issue repeated requests across all preset-touching entrypoints when loader keeps failing', async () => {
        const base = getOptions();
        const loader = jest.fn().mockRejectedValue(new Error('offline'));
        const controller = new Controller({
            ...base,
            baseState: {
                ...base.baseState,
                availablePresets: ['createProject', 'asyncA'],
                activePresets: ['asyncA'],
            },
            config: {...base.config, asyncPresets: loader},
        } as any);

        for (let i = 0; i < 20; i++) {
            await controller.runPreset('asyncA').catch(() => {});
            await controller.addPreset('asyncA').catch(() => {});
            await controller.passStep('asyncAStep1' as any).catch(() => {});
            await controller.finishPreset('asyncA' as any).catch(() => {});
            await controller.resetPresetProgress('asyncA').catch(() => {});
            await controller.setWizardState('visible').catch(() => {});
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            controller.userPresets;
        }

        expect(loader).toHaveBeenCalledTimes(1);
    });

    it('logs error via controller logger on loader failure', async () => {
        const base = getOptions();
        const loader = jest.fn().mockRejectedValue(new Error('boom'));
        const errorLog = jest.fn();
        const controller = new Controller({
            ...base,
            config: {...base.config, asyncPresets: loader},
            logger: {
                level: 'error' as const,
                logger: {debug: () => {}, error: errorLog},
            },
        } as any);

        await expect(controller.runPreset('asyncA')).rejects.toThrow('boom');
        expect(errorLog).toHaveBeenCalledWith(
            expect.stringContaining('Failed to load async presets'),
            expect.any(Error),
        );
    });
});

describe('async presets — key collisions', () => {
    it('keeps sync preset and logs error when async loader returns colliding key', async () => {
        const base = getOptions();
        const errorLog = jest.fn();
        const syncCreateProject = (base.config.presets as any).createProject;
        const loader = jest.fn().mockResolvedValue({
            createProject: {
                name: 'From async — should be ignored',
                steps: [{slug: 'differentStep', name: '', description: ''}],
            },
            asyncA: {
                name: 'Async A',
                steps: [{slug: 'asyncAStep1', name: '', description: ''}],
            },
        });
        const controller = new Controller({
            ...base,
            config: {...base.config, asyncPresets: loader},
            logger: {
                level: 'error' as const,
                logger: {debug: () => {}, error: errorLog},
            },
        } as any);

        await controller.runPreset('asyncA');

        expect(errorLog).toHaveBeenCalledWith(
            expect.stringContaining('collides with sync preset'),
            'createProject',
        );
        expect(controller.options.config.presets.createProject).toBe(syncCreateProject);
    });
});

describe('async presets — combined presets', () => {
    it('combined preset in sync, internal in async — runPreset loads and resolves', async () => {
        const base = getOptions();
        const syncPresets = {
            combo: {
                name: 'Combo',
                type: 'combined' as const,
                internalPresets: ['innerAsync'],
                pickPreset: () => 'innerAsync',
            },
        };
        const loader = jest.fn().mockResolvedValue({
            innerAsync: {
                name: 'Inner',
                type: 'internal' as const,
                steps: [{slug: 'innerStep', name: '', description: ''}],
            },
        });
        const controller = new Controller({
            ...base,
            config: {presets: syncPresets, asyncPresets: loader},
        } as any);

        const ok = await controller.runPreset('combo');

        expect(loader).toHaveBeenCalledTimes(1);
        expect(ok).toBe(true);
        expect(controller.state.base.activePresets).toContain('innerAsync');
    });

    it('combined preset in async, internals in sync — runPreset loads and resolves', async () => {
        const base = getOptions();
        const syncPresets = {
            innerSync: {
                name: 'Inner',
                type: 'internal' as const,
                steps: [{slug: 'innerStep', name: '', description: ''}],
            },
        };
        const loader = jest.fn().mockResolvedValue({
            comboAsync: {
                name: 'Combo',
                type: 'combined' as const,
                internalPresets: ['innerSync'],
                pickPreset: () => 'innerSync',
            },
        });
        const controller = new Controller({
            ...base,
            config: {presets: syncPresets, asyncPresets: loader},
        } as any);

        const ok = await controller.runPreset('comboAsync');

        expect(loader).toHaveBeenCalledTimes(1);
        expect(ok).toBe(true);
        expect(controller.state.base.activePresets).toContain('innerSync');
    });
});

describe('async presets — reach before load', () => {
    it('stepElementReached during pending load resolves and shows hint', async () => {
        const base = getOptions();
        let resolveLoader!: (v: Record<string, any>) => void;
        const loader = jest.fn(
            () =>
                new Promise<Record<string, any>>((res) => {
                    resolveLoader = res;
                }),
        );
        const controller = new Controller({
            ...base,
            baseState: {
                ...base.baseState,
                availablePresets: ['createProject', 'asyncA'],
                activePresets: ['asyncA'],
            },
            config: {...base.config, asyncPresets: loader},
        } as any);

        const mockElement = document.createElement('div');
        document.body.appendChild(mockElement);

        const reachPromise = controller.stepElementReached({
            stepSlug: 'asyncAStep1' as any,
            element: mockElement,
        });

        resolveLoader(asyncPresetsMap());
        await reachPromise;

        expect(loader).toHaveBeenCalledTimes(1);
        expect(controller.hintStore.state.hint?.step.slug).toBe('asyncAStep1');

        document.body.removeChild(mockElement);
    });

    it('element unmounts before load resolves — no hint shown', async () => {
        const base = getOptions();
        let resolveLoader!: (v: Record<string, any>) => void;
        const loader = jest.fn(
            () =>
                new Promise<Record<string, any>>((res) => {
                    resolveLoader = res;
                }),
        );
        const controller = new Controller({
            ...base,
            baseState: {
                ...base.baseState,
                availablePresets: ['createProject', 'asyncA'],
                activePresets: ['asyncA'],
            },
            config: {...base.config, asyncPresets: loader},
        } as any);

        const mockElement = document.createElement('div');
        document.body.appendChild(mockElement);

        const reachPromise = controller.stepElementReached({
            stepSlug: 'asyncAStep1' as any,
            element: mockElement,
        });

        document.body.removeChild(mockElement);
        controller.stepElementDisappeared('asyncAStep1' as any);

        resolveLoader(asyncPresetsMap());
        await reachPromise;

        expect(controller.hintStore.state.hint).toBeUndefined();
    });
});

describe('async presets — suggestPresetOnce', () => {
    it('awaits loader before emitting beforeSuggestPreset so subscribers see merged presets', async () => {
        const {options, loader} = getAsyncOptions();
        const controller = new Controller(options);
        const seenPresets: Array<Record<string, unknown>> = [];
        controller.events.subscribe('beforeSuggestPreset', () => {
            seenPresets.push({...controller.options.config.presets});
            return true;
        });

        await controller.suggestPresetOnce('asyncA');

        expect(loader).toHaveBeenCalledTimes(1);
        expect(seenPresets).toHaveLength(1);
        expect(seenPresets[0]).toHaveProperty('asyncA');
    });
});

describe('async presets — unhandled rejection safety', () => {
    it('fire-and-forget loader failure does not leak unhandledRejection (userPresets getter)', async () => {
        const base = getOptions();
        const loader = jest.fn().mockRejectedValue(new Error('offline'));
        const controller = new Controller({
            ...base,
            config: {...base.config, asyncPresets: loader},
        } as any);

        const unhandled = jest.fn();
        process.on('unhandledRejection', unhandled);
        try {
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            controller.userPresets;
            await flushPromises();
            await flushPromises();
            expect(unhandled).not.toHaveBeenCalled();
        } finally {
            process.removeListener('unhandledRejection', unhandled);
        }
    });

    it('fire-and-forget loader failure does not leak unhandledRejection (setWizardState)', async () => {
        const base = getOptions();
        const loader = jest.fn().mockRejectedValue(new Error('offline'));
        const controller = new Controller({
            ...base,
            baseState: {...base.baseState, wizardState: 'hidden'},
            config: {...base.config, asyncPresets: loader},
        } as any);

        const unhandled = jest.fn();
        process.on('unhandledRejection', unhandled);
        try {
            await controller.setWizardState('visible');
            await flushPromises();
            await flushPromises();
            expect(unhandled).not.toHaveBeenCalled();
        } finally {
            process.removeListener('unhandledRejection', unhandled);
        }
    });
});
