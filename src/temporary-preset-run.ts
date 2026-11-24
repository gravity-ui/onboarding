export type TemporaryPresetRun = {
    completed?: boolean;
    cleanup?: () => void;
};

export class TemporaryPresetLifecycle {
    run?: TemporaryPresetRun;
    private latestRequest = 0;
    private pending?: Promise<unknown>;

    prepare(request: number, signal?: AbortSignal) {
        if (signal?.aborted || request < this.latestRequest) return undefined;

        this.latestRequest = request;
        return () => !signal?.aborted && this.latestRequest === request;
    }

    start(signal: AbortSignal | undefined, onAbort: (run: TemporaryPresetRun) => void) {
        const run: TemporaryPresetRun = {};
        this.run = run;

        if (signal) {
            const abort = () => onAbort(run);
            signal.addEventListener('abort', abort, {once: true});
            run.cleanup = () => signal.removeEventListener('abort', abort);
        }
    }

    addCleanup(run: TemporaryPresetRun, cleanup: () => void) {
        if (this.run !== run) {
            cleanup();
            return;
        }

        const previous = this.run.cleanup;
        this.run.cleanup = () => {
            previous?.();
            cleanup();
        };
    }

    remove(run: TemporaryPresetRun) {
        if (this.run !== run) return false;

        delete this.run;
        run.cleanup?.();
        return true;
    }

    track<T>(work: Promise<T>) {
        const cleanup = () => {
            if (this.pending === work) delete this.pending;
        };

        this.pending = work;
        work.then(cleanup, cleanup);
        return work;
    }

    async afterPending<T>(work: () => Promise<T>) {
        while (this.pending) await this.pending.catch(() => undefined);

        return this.track(work());
    }
}
