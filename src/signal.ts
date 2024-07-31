import Base from './base';
import { Timeout, Handler } from './utils';

const defaultDelay = 0;
const defaultOrderSafe = false;
const defaultExceptionSafe = false;

export default class Signal<T = void> extends Base {
    private syncHandlers?: Handler<T>[];
    private asyncHandlers?: Handler<T>[];
    private timeout?: Timeout;
    private messages?: T[];

    destructor (): void {
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
        if (this.syncHandlers)
            handleQueue(this.syncHandlers, message);

        if (this.asyncHandlers)
            this.scheduleAsync(message);
    }
    public sub (handler: Handler<T>, async = false): void {
        if (async)
            if (this.asyncHandlers)
                this.asyncHandlers.push(handler);
            else
                this.asyncHandlers = [handler];
        else
            if (this.syncHandlers)
                this.syncHandlers.push(handler);
            else
                this.syncHandlers = [handler];

    }
    public unsub (handler: Handler<T>): void {
        let index = -1;
        if (this.syncHandlers) {
            index = this.syncHandlers.indexOf(handler);
            if (index !== -1)
                this.syncHandlers.splice(index, 1);

            if (this.syncHandlers.length === 0)
                delete this.syncHandlers;
        }

        if (index !== -1)
            return;     //since we're unsubscribing only one handler - our job is done here

        if (this.asyncHandlers) {
            index = this.asyncHandlers.indexOf(handler);
            if (index !== -1)
                this.asyncHandlers.splice(index, 1);

            if (this.asyncHandlers.length === 0)
                delete this.asyncHandlers;
        }
    }
    public unsubAll (handler: Handler<T>): void {
        let index: number;
        if (this.syncHandlers) {
            index = this.syncHandlers.indexOf(handler);
            while (index !== -1) {
                this.syncHandlers.splice(index, 1);
                index = this.syncHandlers.indexOf(handler);
            }

            if (this.syncHandlers.length === 0)
                delete this.syncHandlers;
        }

        if (this.asyncHandlers) {
            index = this.asyncHandlers.indexOf(handler);
            while (index !== -1) {
                this.asyncHandlers.splice(index, 1);
                index = this.asyncHandlers.indexOf(handler);
            }

            if (this.asyncHandlers.length === 0)
                delete this.asyncHandlers;
        }
    }
    get handlersAmount (): number {
        return this.syncHandlersAmount + this.asyncHandlersAmount;
    }
    get syncHandlersAmount (): number {
        if (this.syncHandlers)
            return this.syncHandlers.length;

        return 0;
    }

    get asyncHandlersAmount (): number {
        if (this.asyncHandlers)
            return this.asyncHandlers.length;

        return 0;
    }

    /**
     * "Exception safe" means that each handler is done within try...catch block.
     * This approach may turn of some JIT optimisations ons some environments
     * and because of it is turned off by default.
     * */
    static get exceptionSafe (): boolean {
        return exceptionSafe;
    }
    static set exceptionSafe (safe: boolean) {
        exceptionSafe = safe;
    }
    static get defaultExceptionSafe (): boolean {
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
    static get orderSafe (): boolean {
        return orderSafe;
    }
    static set orderSafe (safe: boolean) {
        orderSafe = safe;
    }
    static get defaultOrderSave (): boolean {
        return defaultOrderSafe;
    }

    /**
     * Changing this parameter you change an async delay before
     * events are delivered to async subscribers
     * */
    static get delay (): number {
        return delay;
    }
    static set delay (newDelay: number) {
        delay = newDelay;
    }
    static get defaultDelay (): number {
        return defaultDelay;
    }

    private scheduleAsync (message: T): void {
        if (!this.messages)
            this.messages = [message];
        else
            this.messages.push(message);

        if (this.timeout === undefined)
            this.timeout = setTimeout(this.executeAsync.bind(this), delay);
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
        if (this.asyncHandlers?.length)
            fireAllMessages(this.asyncHandlers, messages);
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
            } catch (e) { /* empty */ }
    else
        for (const handler of handlers)
            handler(message);
}

function fireAllMessages<T> (handlers: Handler<T>[], messages: T[]): void {
    for (const message of messages)
        handleQueue(handlers, message);
}