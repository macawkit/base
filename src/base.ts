import type { Class, Method } from './utils.js';

let counter = 0;

export default class Base {
    public readonly id: number;
    private _destroyed = false;

    constructor () {
        this.id = ++counter;
    }
    destructor (): void {
        for (const key in this)
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete this[key];

        this._destroyed = true;
    }
    get className (): string {
        return this.constructor.name;
    }
    get destroyed (): boolean {
        return this._destroyed;
    }
}

export class UseAfterFree extends Error {
    public readonly className: string;
    readonly method: string;

    constructor ({ className }: Base, method: string) {
        super(`${className}::${method} has been called after ${className} was destroyed`);

        this.className = className;
        this.method = method;

        Object.setPrototypeOf(this, UseAfterFree.prototype);
    }
}

/**
 * Wrap a single method so it throws {@link UseAfterFree} when invoked on a destroyed instance.
 */
export function wrapNoUseAfterFree<T extends Base> (
    methodName: string,
    method: Method<T>
): Method<T>;
export function wrapNoUseAfterFree<T extends Base, P extends readonly unknown[]> (
    Class: Class<T, P>,
    methodName: string
): void;
export function wrapNoUseAfterFree<T extends Base, P extends readonly unknown[]> (
    methodNameOrClass: string | Class<T, P>,
    methodOrName: Method<T> | string
): Method<T> | void {
    if (typeof methodNameOrClass === 'function') {
        const Class = methodNameOrClass;
        const name = methodOrName as string;
        const descriptor = Object.getOwnPropertyDescriptor(Class.prototype, name);
        if (typeof descriptor?.value === 'function') {
            descriptor.value = wrapNoUseAfterFree(name, descriptor.value as Method<T>);
            Object.defineProperty(Class.prototype, name, descriptor);
        }
        return;
    }

    const methodName = methodNameOrClass;
    const method = methodOrName as Method<T>;
    return function (this: T, ...args: unknown[]) {
        if (this.destroyed)
            throw new UseAfterFree(this, methodName);

        return method.apply(this, args);
    };
}

/**
 * Protect every own method on a class prototype from use-after-free calls.
 * Does not affect methods inherited from parent classes.
 */
export function noUseAfterFree<T extends Base, P extends readonly unknown[]> (
    Class: Class<T, P>
): Class<T, P> {
    const propNames = Object.getOwnPropertyNames(Class.prototype);
    for (const name of propNames) {
        if (name === 'constructor')
            continue;

        const descriptor = Object.getOwnPropertyDescriptor(Class.prototype, name);
        if (typeof descriptor?.value === 'function') {
            descriptor.value = wrapNoUseAfterFree(name, descriptor.value as Method<Base>);
            Object.defineProperty(Class.prototype, name, descriptor);
        }
    }

    return Class;
}
