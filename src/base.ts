import { Class, Method } from './utils';

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

        // Set the prototype explicitly.
        Object.setPrototypeOf(this, UseAfterFree.prototype);
    }
}

export function NoUseAfterFree<T extends Base, P extends readonly unknown[]> (Class: Class<T, P>): void;
export function NoUseAfterFree<T extends Base> (target: T, propertyKey: string, descriptor: PropertyDescriptor): void;
export function NoUseAfterFree<T extends Base, P extends readonly unknown[]>
(target: Class<T, P> | T, propertyKey?: string, descriptor?: PropertyDescriptor): void {
    if (typeof target === 'function') {
        const propNames = Object.getOwnPropertyNames(target.prototype);
        for (const name of propNames) {
            if (name === 'constructor')
                continue;

            const descriptor = Object.getOwnPropertyDescriptor(target.prototype, name);
            if (typeof descriptor?.value === 'function') {
                const originalMethod = descriptor.value as Method<Base>;
                descriptor.value = function (this: Base, ...args: unknown[]) {
                    if (this.destroyed)
                        throw new UseAfterFree(this, name);

                    return originalMethod.apply(this, args);
                };
                Object.defineProperty(target.prototype, name, descriptor);
            }

        }
    } else if (propertyKey && descriptor) {
        const originalMethod = descriptor.value as Method<Base>;
        descriptor.value = function (this: Base, ...args: unknown[]) {
            if (this.destroyed)
                throw new UseAfterFree(this, propertyKey);

            return originalMethod.apply(this, args);
        };
    }
}