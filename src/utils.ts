export type Timeout = ReturnType<typeof setTimeout>;
export type Handler<T = void> = (message: T) => void;
export type Class<T, P extends readonly unknown[] = unknown[]> = new (...args: P) => T
export type Method<T> = (this: T, ...args: unknown[]) => unknown;

export class Waiter {
    private resolve!: () => void;
    private promise!: Promise<void>;

    constructor () {
        this.restart();
    }

    public done (): void {
        this.resolve();
    }
    public async wait (): Promise<void> {
        return this.promise;
    }
    public restart (): void {
        this.promise = new Promise<void>(resolve => this.resolve = resolve);
    }
}

export function sleep (milliseconds: number): Promise<void> {
    return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}