/* node:coverage disable */
import { describe, test } from 'node:test';
import assert from 'node:assert';

import { Waiter, sleep, type Handler } from '../src';
import { Base, UseAfterFree, NoUseAfterFree } from '../src';

void describe('Utils', () => {
    void test('Waiter', async () => {
        const waiter = new Waiter();

        const start = Date.now();
        setTimeout(waiter.done.bind(waiter), 20);

        await waiter.wait();
        assert.equal(Date.now() - start >= 19, true);

        await waiter.wait();
        assert.equal(Date.now() - start <= 21, true);

        setTimeout(waiter.done.bind(waiter), 19);
        waiter.restart();
        await waiter.wait();

        assert.equal(Date.now() - start >= 38, true);
    });

    void test('sleep', async () => {
        const start = Date.now();
        await sleep(20);

        assert.equal(Date.now() - start >= 19, true);
    });

    void test('NoUseAfterFree::class', t => {
        const hs = t.mock.fn();
        const hu = t.mock.fn();

        const heirSafe = new HeirSafe(hs);
        const heirUnsafe = new HeirUnsafe(hu);

        heirSafe.callMethod();
        heirUnsafe.callMethod();

        assert.equal(hs.mock.callCount(), 1);
        assert.equal(hu.mock.callCount(), 1);

        heirUnsafe.destructor();
        heirSafe.destructor();

        assert.equal(heirUnsafe.destroyed, true);
        assert.equal(heirSafe.destroyed, true);

        //should not throw;
        heirUnsafe.callMethod();
        assert.throws(heirSafe.callMethod.bind(heirSafe), (error: unknown) => {
            assert.ok(error instanceof UseAfterFree);
            assert.equal(error.className, 'HeirSafe');
            assert.equal(error.method, 'callMethod');
            assert.equal(error.message, 'HeirSafe::callMethod has been called after HeirSafe was destroyed');

            return true;
        });

        assert.equal(hs.mock.callCount(), 1);
        assert.equal(hu.mock.callCount(), 1);

        //getters are not methods, so the class decorator does not wrap them
        assert.equal(heirSafe.label, 'HeirSafe');

        //should not throw - class safety should only affect top level methods
        heirSafe.destructor();
    });

    void test('NoUseAfterFree::method', t => {
        const h = t.mock.fn();

        const heir = new HeirMethodSafe(h);

        heir.callMethod();

        assert.equal(h.mock.callCount(), 1);

        heir.destructor();

        assert.equal(heir.destroyed, true);

        //should not throw;
        heir.callMethod();
        assert.throws(heir.callSafeMethod.bind(heir), (error: unknown) => {
            assert.ok(error instanceof UseAfterFree);
            assert.equal(error.className, 'HeirMethodSafe');
            assert.equal(error.method, 'callSafeMethod');
            assert.equal(error.message, 'HeirMethodSafe::callSafeMethod has been called after HeirMethodSafe was destroyed');

            return true;
        });

        assert.equal(h.mock.callCount(), 1);
    });
});

@NoUseAfterFree
class HeirSafe extends Base {
    private readonly handler: Handler;

    constructor (handler: Handler) {
        super();
        this.handler = handler;
    }
    public get label (): string {
        return this.className;
    }
    public callMethod (): void {
        this.handler();
    }
}

class HeirUnsafe extends Base {
    private readonly handler: Handler;

    constructor (handler: Handler) {
        super();
        this.handler = handler;
    }
    public callMethod (): void {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (this.handler)
            this.handler();
    }
}

class HeirMethodSafe extends Base {
    private readonly handler: Handler;

    constructor (handler: Handler) {
        super();
        this.handler = handler;
    }
    public callMethod (): void {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (this.handler)
            this.handler();
    }

    @NoUseAfterFree
    public callSafeMethod (): void {
        this.handler();
    }
}
