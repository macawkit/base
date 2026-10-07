/* node:coverage disable */
import { describe, test } from 'node:test';
import assert from 'node:assert';

import {
    compare,
    compareArray,
    compareBinary,
    compareMap,
    compareObject,
    compareSet,
    find,
    isRecord,
    keyExist
} from '../src';

void describe('compare', () => {
    void test('equal values', () => {
        const same = { a: 1 };
        const fn = (): number => 1;
        const sym = Symbol('a');

        assert.strictEqual(compare(1, 1), true);
        assert.strictEqual(compare(0, -0), true);
        assert.strictEqual(compare(NaN, NaN), true);
        assert.strictEqual(compare('a', 'a'), true);
        assert.strictEqual(compare(true, true), true);
        assert.strictEqual(compare(1n, 1n), true);
        assert.strictEqual(compare(undefined, undefined), true);
        assert.strictEqual(compare(null, null), true);
        assert.strictEqual(compare(fn, fn), true);
        assert.strictEqual(compare(sym, sym), true);
        assert.strictEqual(compare(same, same), true);
    });

    void test('same type, different value', () => {
        assert.strictEqual(compare(1, 2), false);
        assert.strictEqual(compare(NaN, 1), false);
        assert.strictEqual(compare('a', 'b'), false);
        assert.strictEqual(compare(true, false), false);
        assert.strictEqual(compare(1n, 2n), false);
        assert.strictEqual(compare((): number => 1, (): number => 1), false);
        assert.strictEqual(compare(Symbol('a'), Symbol('a')), false);
    });

    void test('different types', () => {
        assert.strictEqual(compare(1, '1'), false);
        assert.strictEqual(compare(0, false), false);
        assert.strictEqual(compare(0n, 0), false);
        assert.strictEqual(compare(null, undefined), false);
        assert.strictEqual(compare(undefined, null), false);
    });

    void test('null is only equal to null', () => {
        assert.strictEqual(compare(null, {}), false);
        assert.strictEqual(compare({}, null), false);
        assert.strictEqual(compare(null, []), false);
        assert.strictEqual(compare(null, 0), false);
    });

    void test('dates by time', () => {
        const first = new Date('2020-01-01T00:00:00Z');

        assert.strictEqual(compare(first, new Date(first.getTime())), true);
        assert.strictEqual(compare(new Date(0), new Date(1)), false);
        assert.strictEqual(compare(new Date(NaN), new Date(NaN)), true);
        assert.strictEqual(compare(new Date(NaN), new Date(0)), false);
        assert.strictEqual(compare(new Date(0), new Date(NaN)), false);
        assert.strictEqual(compare(new Date(0), {}), false);
        assert.strictEqual(compare(/a/, new Date(0)), false);
    });

    void test('regexps by source and flags', () => {
        assert.strictEqual(compare(/a/g, /a/g), true);
        assert.strictEqual(compare(/a/gi, /a/ig), true);
        assert.strictEqual(compare(/a/g, /b/g), false);
        assert.strictEqual(compare(/a/g, /a/i), false);
        assert.strictEqual(compare(/a/, {}), false);
    });

    void test('lastIndex is not part of the pattern', () => {
        const first = /a/g;
        const second = /a/g;
        first.lastIndex = 3;

        assert.strictEqual(compare(first, second), true);
    });

    void test('dispatches by container kind', () => {
        assert.strictEqual(compare([1], [1]), true);
        assert.strictEqual(compare([1], { 0: 1, length: 1 }), false);
        assert.strictEqual(compare(new Map([['a', 1]]), new Map([['a', 1]])), true);
        assert.strictEqual(compare(new Map(), []), false);
        assert.strictEqual(compare(new Set([1]), new Set([1])), true);
        assert.strictEqual(compare(new Set(), new Map()), false);
        assert.strictEqual(compare(buffer([1]), buffer([1])), true);
        assert.strictEqual(compare(buffer([1]), buffer([2])), false);
        assert.strictEqual(compare(buffer([1]), { byteLength: 1 }), false);
        assert.strictEqual(compare({ a: 1 }, { a: 1 }), true);
        assert.strictEqual(compare(new User(), { id: 1, name: 'a' }), false);
        assert.strictEqual(compare(new User(), new User()), true);
    });

    void test('a date is not a plain object', () => {
        assert.strictEqual(compare({}, new Date(0)), false);
    });

    void test('an array is not a plain object', () => {
        assert.strictEqual(compare({}, []), false);
    });

    void test('an indexed object is not an array', () => {
        assert.strictEqual(compare({ 0: 1 }, [1]), false);
    });

    void test('a regexp is not a plain object', () => {
        assert.strictEqual(compare({}, /a/), false);
    });

    void test('a map is not a plain object', () => {
        assert.strictEqual(compare({}, new Map()), false);
    });

    void test('a set is not a plain object', () => {
        assert.strictEqual(compare({}, new Set()), false);
    });

    void test('an array buffer is not a plain object', () => {
        assert.strictEqual(compare({}, buffer([1, 2, 3])), false);
    });

    void test('a data view is not a plain object', () => {
        assert.strictEqual(compare({}, dataView([1, 2, 3])), false);
    });

    void test('an empty typed array is not a plain object', () => {
        assert.strictEqual(compare({}, new Uint8Array()), false);
    });

    void test('a typed array is not a plain object', () => {
        assert.strictEqual(compare({}, new Uint8Array([1])), false);
    });
});

void describe('compareArray', () => {
    void test('equal elements in order', () => {
        assert.strictEqual(compareArray([], []), true);
        assert.strictEqual(compareArray([1, 'a', null], [1, 'a', null]), true);
        assert.strictEqual(compareArray([[1, { b: 2 }]], [[1, { b: 2 }]]), true);
        assert.strictEqual(compareArray([undefined], [undefined]), true);
        assert.strictEqual(compareArray([NaN], [NaN]), true);
    });

    void test('length and element mismatches', () => {
        assert.strictEqual(compareArray([1, 2], [1]), false);
        assert.strictEqual(compareArray([1], [1, 2]), false);
        assert.strictEqual(compareArray([1, 2], [1, 3]), false);
        assert.strictEqual(compareArray([1, 2, 3], [1, 9, 3]), false);
        assert.strictEqual(compareArray([undefined], [null]), false);
    });

    void test('named properties are not elements', () => {
        const values: number[] & { extra?: number } = [1];
        values.extra = 2;

        assert.strictEqual(compareArray(values, [1]), true);
    });
});

void describe('compareMap', () => {
    void test('entries match regardless of order', () => {
        const first = new Map<unknown, unknown>([['a', 1], ['b', { x: 1 }]]);
        const second = new Map<unknown, unknown>([['b', { x: 1 }], ['a', 1]]);

        assert.strictEqual(compareMap(first, second), true);
        assert.strictEqual(compareMap(new Map(), new Map()), true);
        assert.strictEqual(compareMap(new Map([[NaN, NaN]]), new Map([[NaN, NaN]])), true);
        assert.strictEqual(
            compareMap(new Map([[{ id: 1 }, 'a']]), new Map([[{ id: 1 }, 'a']])),
            true
        );
        assert.strictEqual(
            compareMap(
                new Map([[{ n: 1 }, 1], [{ n: 1 }, 1]]),
                new Map([[{ n: 1 }, 1], [{ n: 1 }, 1]])
            ),
            true
        );
    });

    void test('duplicate deep-equal keys match in any order', () => {
        assert.strictEqual(
            compareMap(
                new Map([[{ n: 1 }, 'a'], [{ n: 1 }, 'b']]),
                new Map([[{ n: 1 }, 'b'], [{ n: 1 }, 'a']])
            ),
            true
        );
    });

    void test('size, key, or value mismatch', () => {
        assert.strictEqual(compareMap(new Map([['a', 1]]), new Map()), false);
        assert.strictEqual(compareMap(new Map([['a', 1]]), new Map([['a', 2]])), false);
        assert.strictEqual(compareMap(new Map([['a', 1]]), new Map([['b', 1]])), false);
        assert.strictEqual(
            compareMap(
                new Map<unknown, unknown>([[1, 'a'], [2, 'b']]),
                new Map<unknown, unknown>([[1, 'a'], [3, 'b']])
            ),
            false
        );
        assert.strictEqual(
            compareMap(
                new Map([[{ n: 1 }, 1], [{ n: 1 }, 2]]),
                new Map([[{ n: 1 }, 1], [{ n: 1 }, 1]])
            ),
            false
        );
    });


    void test('each deep-equal key is paired once', () => {
        const left = new Map([[{ x: 1 }, 1], [{ x: 1 }, 1]]);
        const right = new Map([[{ x: 1 }, 1], [{ y: 2 }, 99]]);

        assert.strictEqual(compareMap(left, right), false);
    });

    void test('pairing does not depend on which map is first', () => {
        const left = new Map([[{ x: 1 }, 1], [{ x: 1 }, 1]]);
        const right = new Map([[{ x: 1 }, 1], [{ y: 2 }, 99]]);

        assert.strictEqual(compareMap(right, left), false);
    });
});

void describe('compareSet', () => {
    void test('members match regardless of order', () => {
        assert.strictEqual(compareSet(new Set([1, 2, 3]), new Set([3, 1, 2])), true);
        assert.strictEqual(compareSet(new Set(), new Set()), true);
        assert.strictEqual(compareSet(new Set([NaN]), new Set([NaN])), true);
        assert.strictEqual(compareSet(new Set([{ x: 1 }]), new Set([{ x: 1 }])), true);
        assert.strictEqual(
            compareSet(new Set([{ n: 1 }, { n: 2 }]), new Set([{ n: 2 }, { n: 1 }])),
            true
        );
        assert.strictEqual(
            compareSet(new Set([{ n: 1 }, { n: 1 }]), new Set([{ n: 1 }, { n: 1 }])),
            true
        );
    });

    void test('size or member mismatch', () => {
        assert.strictEqual(compareSet(new Set([1, 2]), new Set([1])), false);
        assert.strictEqual(compareSet(new Set([1]), new Set([2])), false);
        assert.strictEqual(compareSet(new Set([{ x: 1 }]), new Set([{ x: 2 }])), false);
    });

    void test('each deep-equal member is paired once', () => {
        const left = new Set([{ x: 1 }, { x: 1 }]);
        const right = new Set([{ x: 1 }, { y: 2 }]);

        assert.strictEqual(compareSet(left, right), false);
    });

    void test('pairing does not depend on which set is first', () => {
        const left = new Set([{ x: 1 }, { x: 1 }]);
        const right = new Set([{ x: 1 }, { y: 2 }]);

        assert.strictEqual(compareSet(right, left), false);
    });
});

void describe('compareObject', () => {
    void test('own enumerable keys, order ignored', () => {
        assert.strictEqual(compareObject({}, {}), true);
        assert.strictEqual(
            compareObject({ z: 1, a: [1, { b: 2 }] }, { a: [1, { b: 2 }], z: 1 }),
            true
        );
        assert.strictEqual(compareObject({ a: undefined }, { a: undefined }), true);
        assert.strictEqual(compareObject(Object.create(null) as Record<string, unknown>, {}), false);

        const left: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
        const right: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
        left['a'] = 1;
        right['a'] = 1;
        assert.strictEqual(compareObject(left, right), true);
    });

    void test('missing, extra, and different own values', () => {
        assert.strictEqual(compareObject({ a: 1 }, { a: 2 }), false);
        assert.strictEqual(compareObject({ a: 1 }, {}), false);
        assert.strictEqual(compareObject({}, { a: 1 }), false);
        assert.strictEqual(compareObject({ a: 1 }, { a: 1, b: 2 }), false);
        assert.strictEqual(compareObject({ a: 1, b: 2 }, { a: 1 }), false);
        assert.strictEqual(compareObject({ a: 1, b: undefined }, { a: 1 }), false);
        assert.strictEqual(compareObject({ a: 1 }, { a: 1, b: undefined }), false);
        assert.strictEqual(compareObject({ a: 1, b: undefined }, { a: 1, b: 2 }), false);
    });

    void test('an own property differs from the same name on the prototype', () => {
        const inherited = Object.create({ id: 1 }) as Record<string, unknown>;

        assert.strictEqual(compareObject({ id: 1 }, inherited), false);
        assert.strictEqual(compareObject(inherited, { id: 1 }), false);
    });

    void test('inherited properties are ignored', () => {
        const inherited = Object.create({ extra: 1 }) as Record<string, unknown>;

        assert.strictEqual(compareObject(inherited, {}), true);
    });

    void test('ignoring inherited properties does not depend on argument order', () => {
        const inherited = Object.create({ extra: 1 }) as Record<string, unknown>;

        assert.strictEqual(compareObject({}, inherited), true);
    });

    void test('inherited values do not distinguish two objects', () => {
        const first = Object.create({ a: 1 }) as Record<string, unknown>;
        const second = Object.create({ a: 2 }) as Record<string, unknown>;

        assert.strictEqual(compareObject(first, second), true);
    });

    void test('an inherited field does not hide equal own fields', () => {
        const withOwn: Record<string, unknown> = Object.create({ extra: 1 }) as Record<string, unknown>;
        withOwn['a'] = 1;

        assert.strictEqual(compareObject(withOwn, { a: 1 }), true);
    });

    void test('equal own fields stay equal with an inherited field on the right', () => {
        const withOwn: Record<string, unknown> = Object.create({ extra: 1 }) as Record<string, unknown>;
        withOwn['a'] = 1;

        assert.strictEqual(compareObject({ a: 1 }, withOwn), true);
    });
});

void describe('keyExist', () => {
    void test('deep-equal key', () => {
        assert.strictEqual(keyExist(new Set([1, 2]), 2), true);
        assert.strictEqual(keyExist(new Set([1, 2]), 3), false);
        assert.strictEqual(keyExist(new Set(), 1), false);
        assert.strictEqual(keyExist(new Map([[1, 'a']]), 1), true);
        assert.strictEqual(keyExist(new Map([[1, 'a']]), 2), false);
        assert.strictEqual(keyExist(new Set([{ id: 1 }, { id: 2 }]), { id: 2 }), true);
        assert.strictEqual(keyExist(new Set([{ id: 1 }]), { id: 2 }), false);
        assert.strictEqual(keyExist(new Set([NaN]), NaN), true);
    });
});

void describe('find', () => {
    void test('returns the first deep-equal value, or the default', () => {
        const container = new Map<unknown, string>([[{ id: 1 }, 'no'], ['hit', 'yes']]);

        assert.strictEqual(find(container, 'hit', 'default'), 'yes');
        assert.strictEqual(find(container, { id: 1 }, 'default'), 'no');
        assert.strictEqual(find(container, 'miss', 'default'), 'default');
        assert.strictEqual(find(new Map(), 'miss', 0), 0);

        const duplicates = new Map<unknown, string>([[{ id: 1 }, 'first'], [{ id: 1 }, 'second']]);
        assert.strictEqual(find(duplicates, { id: 1 }, 'default'), 'first');

        const blanks = new Map<unknown, undefined>([[1, undefined]]);
        assert.strictEqual(find(blanks, 1, 'missing'), undefined);
        assert.strictEqual(find(blanks, 2, 'missing'), 'missing');
    });
});

void describe('compareBinary', () => {
    void test('array buffers by bytes', () => {
        assert.strictEqual(compareBinary(buffer([]), buffer([]), false), true);
        assert.strictEqual(compareBinary(buffer([4, 5]), buffer([4, 5]), false), true);
        assert.strictEqual(compareBinary(buffer([4, 5]), buffer([4, 6]), false), false);
        assert.strictEqual(compareBinary(buffer([1]), buffer([1, 2]), false), false);
        assert.strictEqual(compareBinary(buffer([1]), new Uint8Array([1]), false), false);
        assert.strictEqual(compareBinary(new Uint8Array([1]), buffer([1]), false), false);
    });

    void test('data views by their own bytes', () => {
        assert.strictEqual(compareBinary(dataView([]), dataView([]), false), true);
        assert.strictEqual(compareBinary(dataView([4, 5]), dataView([4, 5]), false), true);
        assert.strictEqual(compareBinary(dataView([4, 5]), dataView([4, 6]), false), false);
        assert.strictEqual(compareBinary(dataView([1]), dataView([1, 2]), false), false);
        assert.strictEqual(compareBinary(dataView([1]), buffer([1]), false), false);
        assert.strictEqual(compareBinary(dataView([0xff]), dataView([0xff]), false), true);

        const raw = new Uint8Array([1, 2, 3, 4]);
        const slice = new DataView(raw.buffer, 1, 2);
        assert.strictEqual(compareBinary(slice, dataView([2, 3]), false), true);
    });

    void test('typed arrays by their own bytes', () => {
        const raw = new Uint8Array([9, 1, 2, 9]);

        assert.strictEqual(compareBinary(new Uint8Array([]), new Uint8Array([]), false), true);
        assert.strictEqual(compareBinary(new Uint8Array([1, 2]), new Uint8Array([1, 2]), false), true);
        assert.strictEqual(compareBinary(new Uint8Array([1, 2]), new Uint8Array([1, 3]), false), false);
        assert.strictEqual(compareBinary(new Uint8Array([1]), new Uint8Array([1, 2]), false), false);
        assert.strictEqual(compareBinary(raw.subarray(1, 3), new Uint8Array([1, 2]), false), true);
        assert.strictEqual(compareBinary(new Uint16Array([1, 2]), new Uint16Array([1, 2]), false), true);
        assert.strictEqual(compareBinary(new Uint16Array([1, 2]), new Uint16Array([1, 3]), false), false);
        assert.strictEqual(compareBinary(new Uint8Array([1]), {}, false), false);
        assert.strictEqual(compareBinary(new Uint8Array([1]), dataView([1]), false), false);
    });

    void test('NaN bytes match', () => {
        const values = new Float64Array([NaN]);

        assert.strictEqual(compareBinary(values, new Float64Array(values), false), true);
    });

    void test('different view types with the same bytes match', () => {
        assert.strictEqual(compareBinary(new Int8Array([-1]), new Uint8Array([255]), false), true);
    });

    void test('a typed array matches a byte view of itself', () => {
        const values = new Uint16Array([0x0102]);
        const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength);

        assert.strictEqual(compareBinary(values, bytes, false), true);
    });

    void test('non-binary values return the default', () => {
        assert.strictEqual(compareBinary(1, 1, false), false);
        assert.strictEqual(compareBinary({}, {}, 'no'), 'no');
        assert.strictEqual(compareBinary(null, null, false), false);
    });
});

void describe('isRecord', () => {
    void test('plain objects', () => {
        assert.strictEqual(isRecord({}), true);
        assert.strictEqual(isRecord(Object.create(null)), true);
        assert.strictEqual(isRecord(new User()), true);
    });

    void test('rejected values', () => {
        assert.strictEqual(isRecord(1), false);
        assert.strictEqual(isRecord('a'), false);
        assert.strictEqual(isRecord(undefined), false);
        assert.strictEqual(isRecord(null), false);
        assert.strictEqual(isRecord([]), false);
        assert.strictEqual(isRecord(new Date()), false);
        assert.strictEqual(isRecord(/a/), false);
        assert.strictEqual(isRecord(new Map()), false);
        assert.strictEqual(isRecord(new Set()), false);
        assert.strictEqual(isRecord(new ArrayBuffer(0)), false);
        assert.strictEqual(isRecord(new DataView(new ArrayBuffer(0))), false);
        assert.strictEqual(isRecord(new Uint8Array()), false);
    });
});

class User {
    public id = 1;
    public name = 'a';
}

function buffer (bytes: readonly number[]): ArrayBuffer {
    const result = new ArrayBuffer(bytes.length);
    const view = new Uint8Array(result);
    for (let i = 0; i < bytes.length; i++)
        view[i] = bytes[i] ?? 0;

    return result;
}

function dataView (bytes: readonly number[]): DataView {
    return new DataView(buffer(bytes));
}
