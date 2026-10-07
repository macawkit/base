import Base from './base';
import type { Timeout, Handler } from './utils';

const defaultDelay = 0;
const defaultOrderSafe = false;
const defaultExceptionSafe = false;

export default class Signal<T = void> extends Base {
    private syncHandlers?: Handler<T>[];
    private asyncHandlers?: Handler<T>[];
    private syncOnce?: number[];
    private asyncOnce?: number[];
    private timeout?: Timeout;
    private messages?: T[];

    public override destructor (): void {
        this.cancelAsync();

        //to emit scheduled events
        if (this.asyncHandlers?.length && this.messages?.length)
            setTimeout(fireAllMessages.bind<
                // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
                null, [Handler<T>[], T[]], [], void
            >(null, this.asyncHandlers, this.messages), delay);

        super.destructor();
    }

    public emit (message: T): void {
        if (this.syncHandlers) {
            handleQueue(this.syncHandlers, message);
            if (this.syncOnce) {
                for (let i = this.syncOnce.length - 1; i >= 0; --i) {
                    const index = this.syncOnce[i];
                    if (index !== undefined)
                        this.syncHandlers.splice(index, 1);
                }

                delete this.syncOnce;
            }
        }

        if (this.asyncHandlers)
            this.scheduleAsync(message);
    }
    public sub (handler: Handler<T>, async = false): void {
        if (async)
            this.addAsyncHandler(handler);
        else
            this.addSyncHandler(handler);
    }
    public once (handler: Handler<T>, async = false): void {
        if (async) {
            if (this.asyncOnce)
                this.asyncOnce.push(this.asyncHandlersAmount);
            else
                this.asyncOnce = [this.asyncHandlersAmount];

            this.addAsyncHandler(handler);
        } else {
            if (this.syncOnce)
                this.syncOnce.push(this.syncHandlersAmount);
            else
                this.syncOnce = [this.syncHandlersAmount];

            this.addSyncHandler(handler);
        }
    }
    public unsub (handler: Handler<T>): boolean {
        if (this.syncHandlers) {
            const index = this.syncHandlers.indexOf(handler);
            if (index !== -1) {
                this.syncHandlers.splice(index, 1);

                if (this.syncHandlers.length === 0) {
                    delete this.syncHandlers;
                    delete this.syncOnce;
                } else if (this.syncOnce) {
                    updateIndices(this.syncOnce, index);
                    if (this.syncOnce.length === 0)
                        delete this.syncOnce;
                }

                return true; //since we're unsubscribing only one handler - our job is done here
            }
        }

        if (this.asyncHandlers) {
            const index = this.asyncHandlers.indexOf(handler);
            if (index !== -1) {
                this.asyncHandlers.splice(index, 1);

                if (this.asyncHandlers.length === 0) {
                    delete this.asyncHandlers;
                    delete this.asyncOnce;
                } else if (this.asyncOnce) {
                    updateIndices(this.asyncOnce, index);
                    if (this.asyncOnce.length === 0)
                        delete this.asyncOnce;
                }

                return true;
            }
        }

        return false;
    }
    public unsubAll (handler: Handler<T>): boolean {
        let index: number;
        let removed = false;
        if (this.syncHandlers) {
            index = this.syncHandlers.indexOf(handler);
            while (index !== -1) {
                this.syncHandlers.splice(index, 1);
                if (this.syncOnce) {
                    updateIndices(this.syncOnce, index);
                    if (this.syncOnce.length === 0)
                        delete this.syncOnce;
                }
                index = this.syncHandlers.indexOf(handler);
                removed = true;
            }

            if (this.syncHandlers.length === 0)
                delete this.syncHandlers;
        }

        if (this.asyncHandlers) {
            index = this.asyncHandlers.indexOf(handler);
            while (index !== -1) {
                this.asyncHandlers.splice(index, 1);
                if (this.asyncOnce) {
                    updateIndices(this.asyncOnce, index);
                    if (this.asyncOnce.length === 0)
                        delete this.asyncOnce;
                }
                index = this.asyncHandlers.indexOf(handler);
                removed = true;
            }

            if (this.asyncHandlers.length === 0)
                delete this.asyncHandlers;
        }

        return removed;
    }

    public watch (handler: Handler<T>, async = false): () => void {
        this.sub(handler, async);

        return () => { this.unsub(handler); };
    }

    public get handlersAmount (): number {
        return this.syncHandlersAmount + this.asyncHandlersAmount;
    }
    public get syncHandlersAmount (): number {
        if (this.syncHandlers)
            return this.syncHandlers.length;

        return 0;
    }

    public get asyncHandlersAmount (): number {
        if (this.asyncHandlers)
            return this.asyncHandlers.length;

        return 0;
    }

    /**
     * "Exception safe" means that each handler is done within try...catch block.
     * This approach may turn of some JIT optimisations on some environments
     * and because of it is turned off by default.
     * */
    public static get exceptionSafe (): boolean {
        return exceptionSafe;
    }
    public static set exceptionSafe (safe: boolean) {
        exceptionSafe = safe;
    }
    public static get defaultExceptionSafe (): boolean {
        return defaultExceptionSafe;
    }

    /**
     * "Order safe" means that before handling the queue of handlers
     * that queue is going to be copied to ensure
     * that any subscriptions/unsibscriptions done during handlers executions
     * do not interfere with original queue.
     * This is not very expensive but since it involves additional copying
     * it is switched off by default.
     * You might need to switch it on if your app is complex enough, and
     * you notice that some events are lost
     * */
    public static get orderSafe (): boolean {
        return orderSafe;
    }
    public static set orderSafe (safe: boolean) {
        orderSafe = safe;
    }
    public static get defaultOrderSave (): boolean {
        return defaultOrderSafe;
    }

    /**
     * Changing this parameter you change an async delay before
     * events are delivered to async subscribers
     * */
    public static get delay (): number {
        return delay;
    }
    public static set delay (newDelay: number) {
        delay = newDelay;
    }
    public static get defaultDelay (): number {
        return defaultDelay;
    }

    private scheduleAsync (message: T): void {
        if (!this.messages)
            this.messages = [message];
        else
            this.messages.push(message);

        this.timeout ??= setTimeout(this.executeAsync.bind(this), delay);
    }
    private cancelAsync (): void {
        if (this.timeout === undefined)
            return;

        clearTimeout(this.timeout);
    }
    private executeAsync (): void {
        delete this.timeout;
        if (!this.messages?.length)
            return;

        const messages = this.messages;
        this.messages = [];
        if (this.asyncHandlers?.length) {
            fireAllMessages(this.asyncHandlers, messages);

            if (this.asyncOnce) {
                for (let i = this.asyncOnce.length - 1; i >= 0; --i) {
                    const index = this.asyncOnce[i];
                    if (index !== undefined)
                        this.asyncHandlers.splice(index, 1);
                }

                delete this.asyncOnce;
            }
        }
    }
    private addSyncHandler (handler: Handler<T>) {
        if (this.syncHandlers)
            this.syncHandlers.push(handler);
        else
            this.syncHandlers = [handler];
    }
    private addAsyncHandler (handler: Handler<T>) {
        if (this.asyncHandlers)
            this.asyncHandlers.push(handler);
        else
            this.asyncHandlers = [handler];
    }
}

let exceptionSafe = defaultExceptionSafe;
let orderSafe = defaultOrderSafe;
let delay = defaultDelay;

function handleQueue<T> (handlers: Handler<T>[], message: T): void {
    if (orderSafe)
        handlers = handlers.slice();

    if (exceptionSafe)
        for (const handler of handlers)
            try {
                handler(message);
            } catch { /* empty */ }
    else
        for (const handler of handlers)
            handler(message);
}

function fireAllMessages<T> (handlers: Handler<T>[], messages: T[]): void {
    for (const message of messages)
        handleQueue(handlers, message);
}

function updateIndices (indices: number[], index: number): void {
    for (let i = 0; i < indices.length; ++i) {
        const current = indices[i];
        if (current === undefined)
            continue;

        if (current > index)
            indices[i] = current - 1;
        else if (current === index)
            indices.splice(i--, 1);
    }
}
