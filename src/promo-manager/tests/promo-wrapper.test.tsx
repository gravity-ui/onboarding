import {act, render} from '@testing-library/react';
import {StrictMode, createElement} from 'react';
import {PromoWrapper, createPromoManager} from '../core';
import type {PromoProgressState} from '../core/types';
import {testOptions} from './options';

const timeoutConfig = {...testOptions.config, init: {initType: 'timeout', timeout: 3000}} as const;

describe('PromoWrapper unmount', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => {
        vi.useRealTimers();
        document.body.replaceChildren();
    });

    it('does not record progress when unmounted before activation', async () => {
        const save = vi.fn(async () => {});
        const {controller} = createPromoManager({
            ...testOptions,
            onSave: {progress: save},
            config: timeoutConfig,
        });
        const cancelled = vi.fn();
        controller.events.subscribe('cancelPromo', cancelled);
        const view = render(
            createElement(PromoWrapper, {showOnPromo: 'boardPoll', children: 'Promo'}),
        );
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        view.unmount();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(3000);
        });

        expect(controller.getActivePromo()).toBe(null);
        expect(controller.getPromoStatus('boardPoll')).toBe('canRun');
        expect(controller.state.progress?.progressInfoByPromo).toEqual({});
        expect(cancelled).not.toHaveBeenCalled();
        expect(save).not.toHaveBeenCalled();
        expect(await controller.requestStart('boardPoll')).toBe(true);
    });

    it('does not record progress when unmounted while progress is loading', async () => {
        let resolveProgress!: (progress: Partial<PromoProgressState>) => void;
        const progress = new Promise<Partial<PromoProgressState>>((resolve) => {
            resolveProgress = resolve;
        });
        const save = vi.fn(async () => {});
        const {controller} = createPromoManager({
            ...testOptions,
            progressState: undefined,
            getProgressState: () => progress,
            onSave: {progress: save},
            config: timeoutConfig,
        });
        const view = render(
            createElement(PromoWrapper, {showOnPromo: 'boardPoll', children: 'Promo'}),
        );
        view.unmount();
        await act(async () => {
            resolveProgress({});
            await vi.advanceTimersByTimeAsync(3000);
        });

        expect(controller.getActivePromo()).toBe(null);
        expect(controller.getPromoStatus('boardPoll')).toBe('canRun');
        expect(save).not.toHaveBeenCalled();
    });

    it('shows the promo under StrictMode', async () => {
        const {controller} = createPromoManager({...testOptions, config: timeoutConfig});
        const view = render(
            createElement(
                StrictMode,
                null,
                createElement(PromoWrapper, {showOnPromo: 'boardPoll', children: 'Promo'}),
            ),
        );
        await act(async () => {
            await vi.advanceTimersByTimeAsync(3000);
        });

        expect(controller.getActivePromo()).toBe('boardPoll');
        expect(view.container.textContent).toBe('Promo');
    });

    it('closes an active promo on unmount without finishing it', async () => {
        const {controller} = createPromoManager({...testOptions, config: timeoutConfig});
        const view = render(
            createElement(PromoWrapper, {showOnPromo: 'boardPoll', children: 'Promo'}),
        );
        await act(async () => {
            await vi.advanceTimersByTimeAsync(3000);
        });
        expect(controller.getActivePromo()).toBe('boardPoll');

        view.unmount();

        expect(controller.getActivePromo()).toBe(null);
        expect(controller.getPromoStatus('boardPoll')).toBe('canRun');
    });
});
