import type { Class, Method } from './utils';

let counter = 0;

export default class Base {
    public readonly id: number;
    private _destroyed = false;

    constructor () {
        this.id = ++counter;
    }
    public destructor (): void {
        for (const key in this)
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete this[key];

        this._destroyed = true;
    }
    public get className (): string {
        return this.constructor.name;
    }
    public get destroyed (): boolean {
        return this._destroyed;
    }
}

export class UseAfterFree extends Error {
    public readonly className: string;
    public readonly method: string;

    constructor ({ className }: Base, method: string) {
        super(`${className}::${method} has been called after ${className} was destroyed`);

        this.className = className;
        this.method = method;

        // Set the prototype explicitly.
        Object.setPrototypeOf(this, UseAfterFree.prototype);
    }
}

function protect (method: Method<Base>, name: string): Method<Base> {
    return function (this: Base, ...args: unknown[]) {
        if (this.destroyed)
            throw new UseAfterFree(this, name);

        return method.apply(this, args);
    };
}

function protectPrototype<T extends Base, P extends readonly unknown[]> (Class: Class<T, P>): void {
    for (const name of Object.getOwnPropertyNames(Class.prototype)) {
        if (name === 'constructor')
            continue;

        const descriptor = Object.getOwnPropertyDescriptor(Class.prototype, name);
        if (typeof descriptor?.value !== 'function')
            continue;

        descriptor.value = protect(descriptor.value as Method<Base>, name);
        Object.defineProperty(Class.prototype, name, descriptor);
    }
}

export function NoUseAfterFree<T extends Base, P extends readonly unknown[]> (
    Class: Class<T, P>,
    context: ClassDecoratorContext<Class<T, P>>
): void;
export function NoUseAfterFree<T extends Base> (
    method: Method<T>,
    context: ClassMethodDecoratorContext<T, Method<T>>
): Method<T>;
export function NoUseAfterFree (
    value: Class<Base> | Method<Base>,
    context: ClassDecoratorContext<Class<Base>> | ClassMethodDecoratorContext<Base, Method<Base>>
): void | Method<Base> {
    if (context.kind === 'class') {
        protectPrototype(value as Class<Base>);
        return;
    }

    return protect(value as Method<Base>, String(context.name));
}
