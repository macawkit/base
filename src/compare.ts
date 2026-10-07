export function compare (a: unknown, b: unknown): boolean {
    if (a === b)
        return true;

    const ta = typeof a;
    const tb = typeof b;
    if (ta !== tb)
        return false;

    if (ta === 'object') {
        if (!a || !b)
            return false;

        if (a instanceof Date) {
            if (!(b instanceof Date))
                return false;

            const aTime = a.getTime();
            const bTime = b.getTime();
            if (aTime !== aTime && bTime !== bTime)
                return true;

            return aTime === bTime;
        }

        if (Array.isArray(a)) {
            if (!Array.isArray(b))
                return false;

            return compareArray(a, b);
        }

        if (a instanceof Map) {
            if (!(b instanceof Map))
                return false;

            return compareMap(a, b);
        }

        if (a instanceof Set) {
            if (!(b instanceof Set))
                return false;

            return compareSet(a, b);
        }

        if (a instanceof RegExp) {
            if (!(b instanceof RegExp))
                return false;

            return a.source === b.source && a.flags === b.flags;
        }

        const binaryResult = compareBinary(a, b, undefined);
        if (binaryResult !== undefined)
            return binaryResult;

        return compareObject(a as Record<string, unknown>, b as Record<string, unknown>);
    }

    return a !== a && b !== b;
}

export function compareArray (a: unknown[], b: unknown[]): boolean {
    if (a.length !== b.length)
        return false;

    for (let i = 0; i < a.length; i++)
        if (!compare(a[i], b[i]))
            return false;


    return true;
}

export function compareMap (a: Map<unknown, unknown>, b: Map<unknown, unknown>): boolean {
    if (a.size !== b.size)
        return false;

    const used = new Set<unknown>();
    for (const [aKey, aValue] of a) {
        let found = false;
        for (const [bKey, bValue] of b) {
            if (used.has(bKey))
                continue;

            if (compare(aKey, bKey) && compare(aValue, bValue)) {
                used.add(bKey);
                found = true;
                break;
            }
        }

        if (!found)
            return false;
    }
    
    return true;
}

export function compareSet (a: Set<unknown>, b: Set<unknown>): boolean {
    if (a.size !== b.size)
        return false;

    const used = new Set<unknown>();

    for (const value of a) {
        let found = false;
        for (const bValue of b) {
            if (used.has(bValue))
                continue;

            if (compare(value, bValue)) {
                used.add(bValue);
                found = true;
                break;
            }
        }

        if (!found)
            return false;
    }

    return true;
}

export function compareObject (a: Record<string, unknown>, b: Record<string, unknown>): boolean {
    if (a.constructor !== b.constructor)
        return false;

    const aKeys = Object.keys(a);
    if (aKeys.length !== Object.keys(b).length)
        return false;
    
    for (const key of aKeys)
        if (!Object.hasOwn(b, key) || !compare(a[key], b[key]))
            return false;

    return true;
}

export function keyExist (container: Map<unknown, unknown> | Set<unknown>, key: unknown): boolean {
    for (const target of container.keys())
        if (compare(target, key))
            return true;

    return false;
}

export function find<Default = undefined, Value = unknown> (container: Map<unknown, Value>, key: unknown, defaultResult: Default): Value | Default {
    for (const [target, value] of container)
        if (compare(target, key))
            return value;

    return defaultResult;
}

export function compareBinary<Default = false> (a: unknown, b: unknown, defaultResult: Default): boolean | Default {
    if (!isBinary(a))
        return defaultResult;

    if (!isBinary(b) || binaryKind(a) !== binaryKind(b))
        return false;

    const aBytes = bytes(a);
    const bBytes = bytes(b);
    if (aBytes.length !== bBytes.length)
        return false;

    for (let i = 0; i < aBytes.length; i++)
        if (aBytes[i] !== bBytes[i])
            return false;

    return true;
}

function isBinary (value: unknown): value is ArrayBuffer | ArrayBufferView {
    return value instanceof ArrayBuffer || ArrayBuffer.isView(value);
}

function binaryKind (value: ArrayBuffer | ArrayBufferView): 'buffer' | 'view' | 'typed' {
    if (value instanceof ArrayBuffer)
        return 'buffer';

    if (value instanceof DataView)
        return 'view';

    return 'typed';
}

function bytes (value: ArrayBuffer | ArrayBufferView): Uint8Array {
    if (value instanceof Uint8Array)
        return value;

    if (value instanceof ArrayBuffer)
        return new Uint8Array(value);

    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}

export function isRecord (value: unknown): value is Record<string, unknown> {
    return typeof value === 'object'
        && value !== null
        && !Array.isArray(value)
        && !(value instanceof Date)
        && !(value instanceof RegExp)
        && !(value instanceof Map)
        && !(value instanceof Set)
        && !(value instanceof ArrayBuffer)
        && !(value instanceof DataView)
        && !ArrayBuffer.isView(value);
}