export type Timeout = ReturnType<typeof setTimeout>;
export type Handler<T = void> = (message: T) => void;

export class Waiter {
    public done!: () => void;
    public promise: Promise<void>;

    constructor () {
        this.promise = new Promise<void>(resolve => this.done = resolve);
    }
}