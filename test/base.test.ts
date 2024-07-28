/* node:coverage disable */
import { describe, test } from 'node:test';
import assert from 'node:assert';

import Base from '../src/base';

void describe('Base', () => {
    void test('id', () => {
        const base = new Base();
        assert.notStrictEqual(base.id, 0);

        const another = new Base();
        assert.notEqual(another.id, base.id);
    });

    void test('destructor', () => {
        const base = new Base();
        base.destructor();

        assert.strictEqual(base.id, undefined);
        assert.strictEqual(base.destroyed, true);
    });

    void test('className', () => {
        class Heir extends Base {}

        const base = new Base();
        const heir = new Heir();

        assert.strictEqual(base.className, 'Base');
        assert.strictEqual(heir.className, 'Heir');
    });
});