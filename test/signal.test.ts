/* node:coverage disable */
import { describe, test, type TestContext } from 'node:test';
import assert from 'node:assert';

import Signal from '../src/signal';
import { type Handler, Waiter } from '../src';

void describe('Signal', () => {
    void test('emit::sync', t => {
        const signal = new Signal<void>();
        let result = false;
        const fn = t.mock.fn(() => {result = !result;});

        signal.sub(fn);
        signal.emit();

        assert.strictEqual(result, true);
        assert.strictEqual(fn.mock.callCount(), 1);
        assert.strictEqual(signal.syncHandlersAmount, 1);
        assert.strictEqual(signal.asyncHandlersAmount, 0);
        assert.strictEqual(signal.handlersAmount, 1);

        signal.destructor();

        assert.strictEqual(signal.destroyed, true);

        // I'm considering making signals NoUseAfterFree protected, but not sure yet
        // assert.throws(signal.emit.bind(signal), UseAfterFree);
    });

    void test('emit::async', async t => {
        const signal = new Signal<void>();
        const waiter = new Waiter();
        let result = false;
        const fn = t.mock.fn(() => {
            result = !result;
            waiter.done();
        });

        signal.sub(fn, true);
        signal.emit();

        assert.strictEqual(signal.syncHandlersAmount, 0);
        assert.strictEqual(signal.asyncHandlersAmount, 1);
        assert.strictEqual(signal.handlersAmount, 1);

        //a message should be delivered even after destruction;
        signal.destructor();

        assert.strictEqual(signal.destroyed, true);
        // I'm considering making signals NoUseAfterFree protected, but not sure yet
        // assert.throws(signal.emit.bind(signal), UseAfterFree);

        await waiter.wait();

        assert.strictEqual(result, true);
        assert.strictEqual(fn.mock.callCount(), 1);
    });

    void test('sub-unsub', t => {
        const signal = new Signal<void>();
        let result = false;
        const fn = t.mock.fn<Handler>(() => result = !result);

        signal.sub(fn);
        signal.sub(fn);
        signal.emit();
        assert.strictEqual(result, false);
        assert.strictEqual(fn.mock.callCount(), 2);

        signal.sub(fn);
        signal.emit();
        assert.strictEqual(result, true);
        assert.strictEqual(fn.mock.callCount(), 5);

        signal.unsub(fn);
        signal.emit();
        assert.strictEqual(result, true);
        assert.strictEqual(fn.mock.callCount(), 7);

        assert.strictEqual(signal.syncHandlersAmount, 2);
        assert.strictEqual(signal.asyncHandlersAmount, 0);
        assert.strictEqual(signal.handlersAmount, 2);

        signal.destructor();
    });

    void test('unsubAll', t => {
        const signal = new Signal<void>();
        let result = false;
        const fn = t.mock.fn<Handler>(() => result = !result);

        signal.sub(fn);
        signal.sub(fn);
        signal.sub(fn);
        signal.emit();
        assert.strictEqual(result, true);
        assert.strictEqual(fn.mock.callCount(), 3);

        assert.strictEqual(signal.unsubAll(fn), true);
        signal.emit();
        assert.strictEqual(result, true);
        assert.strictEqual(fn.mock.callCount(), 3);
        assert.strictEqual(signal.handlersAmount, 0);

        signal.destructor();
    });

    void test('message::number', t => {
        const signal = new Signal<number>();
        let result = 0;
        const fn = t.mock.fn<Handler<number>>(message => {result = message;});

        signal.sub(fn);
        signal.emit(7);
        assert.strictEqual(result, 7);
        assert.strictEqual(fn.mock.callCount(), 1);

        signal.destructor();
    });

    void test('emit::async::1', async t => {
        const signal = new Signal<string>();
        let resultS = 'none';
        let resultA = 'none';

        const waiter = new Waiter();
        const fnS = t.mock.fn<Handler<string>>(value => resultS = value);
        const fnA = t.mock.fn<Handler<string>>(value => {
            resultA = value;
            waiter.done();
        });

        signal.sub(fnS);
        signal.sub(fnA, true);

        signal.emit('Done');

        assert.strictEqual(resultS, 'Done');
        assert.strictEqual(fnS.mock.callCount(), 1);

        assert.strictEqual(resultA, 'none');
        assert.strictEqual(fnA.mock.callCount(), 0);

        await waiter.wait();

        assert.strictEqual(resultS, 'Done');
        assert.strictEqual(fnS.mock.callCount(), 1);

        assert.strictEqual(resultA, 'Done');
        assert.strictEqual(fnA.mock.callCount(), 1);

        assert.strictEqual(signal.syncHandlersAmount, 1);
        assert.strictEqual(signal.asyncHandlersAmount, 1);
        assert.strictEqual(signal.handlersAmount, 2);

        signal.destructor();
    });

    void test('emit::async::2', async t => {
        const signal = new Signal<string>();
        let resultS = 'none';
        let resultA = 'none';

        const waiter = new Waiter();
        const fnS = t.mock.fn<Handler<string>>(value => resultS = value);
        const fnA = t.mock.fn<Handler<string>>(value => {
            resultA = value;
            waiter.done();
        });

        signal.sub(fnS);
        signal.sub(fnA, true);

        signal.emit('Done');
        signal.emit('Well-Done');
        signal.emit('Really-Well-Done');

        assert.strictEqual(resultS, 'Really-Well-Done');
        assert.strictEqual(fnS.mock.callCount(), 3);

        assert.strictEqual(resultA, 'none');
        assert.strictEqual(fnA.mock.callCount(), 0);

        await waiter.wait();

        assert.strictEqual(resultS, 'Really-Well-Done');
        assert.strictEqual(fnS.mock.callCount(), 3);

        assert.strictEqual(resultA, 'Really-Well-Done');
        assert.strictEqual(fnA.mock.callCount(), 3);

        signal.destructor();
    });

    void test('delay', async () => {
        const signal = new Signal<number>();
        const waiter = new Waiter();
        let duration = 0;

        signal.sub(start => {
            duration = Date.now() - start;
            waiter.done();
        }, true);

        try {
            signal.emit(Date.now());
            await waiter.wait();

            const immediate = duration;
            // setTimeout(0) often takes a few ms, and a busy loop can take longer.
            assert.equal(immediate >= 0, true);
            assert.equal(immediate < 50, true);
            assert.strictEqual(Signal.delay, Signal.defaultDelay);

            Signal.delay = 20;
            assert.strictEqual(Signal.delay, 20);
            waiter.restart();
            signal.emit(Date.now());
            await waiter.wait();

            // 20ms can be measured as 19 because Date.now() and the timer clock disagree by 1ms.
            // The ceiling is only there to fail a wait that ran away.
            assert.equal(duration >= 15, true);
            assert.equal(duration >= immediate + 10, true);
            assert.equal(duration < 100, true);

            const delayed = duration;
            Signal.delay = Signal.defaultDelay;
            waiter.restart();
            signal.emit(Date.now());
            await waiter.wait();

            assert.equal(duration >= 0, true);
            assert.equal(duration < 50, true);
            assert.equal(duration + 10 < delayed, true);
        } finally {
            Signal.delay = Signal.defaultDelay;
        }
    });

    void test('order::default', t => {
        Signal.orderSafe = Signal.defaultOrderSave;

        assert.equal(Signal.orderSafe, false);
        testOrder(t, false);
    });
    void test('order::safe', t => {
        Signal.orderSafe = true;
        assert.equal(Signal.orderSafe, true);

        testOrder(t, true);

        Signal.orderSafe = Signal.defaultOrderSave;
    });
    void test('exception::default', t => {
        Signal.exceptionSafe = Signal.defaultExceptionSafe;

        assert.equal(Signal.exceptionSafe, false);
        testException(t, false);
    });
    void test('exception::safe', t => {
        Signal.exceptionSafe = true;
        assert.equal(Signal.exceptionSafe, true);

        testException(t, true);

        Signal.exceptionSafe = Signal.defaultExceptionSafe;
    });

    void test('once::sync::default', t => {
        const signal = new Signal();

        const order: number[] = [];
        const h1 = t.mock.fn(() => order.push(1));
        const h2 = t.mock.fn(() => order.push(2));
        const h3 = t.mock.fn(() => order.push(3));

        signal.sub(h1);
        signal.once(h2);
        signal.sub(h3);
        signal.once(h2);

        signal.emit();

        assert.equal(h1.mock.callCount(), 1);
        assert.equal(h2.mock.callCount(), 2);
        assert.equal(h3.mock.callCount(), 1);
        assert.deepEqual(order, [1, 2, 3, 2]);
        assert.equal(signal.handlersAmount, 2);

        order.splice(0, order.length);
        signal.emit();

        assert.equal(h1.mock.callCount(), 2);
        assert.equal(h2.mock.callCount(), 2);
        assert.equal(h3.mock.callCount(), 2);
        assert.deepEqual(order, [1, 3]);

        signal.once(h2);
        signal.sub(h3);
        signal.once(h2);
        signal.sub(h1);

        assert.strictEqual(signal.unsub(h2), true);
        assert.equal(signal.handlersAmount, 5);

        order.splice(0, order.length);
        signal.emit();

        assert.equal(h1.mock.callCount(), 4);
        assert.equal(h2.mock.callCount(), 3);
        assert.equal(h3.mock.callCount(), 4);
        assert.deepEqual(order, [1, 3, 3, 2, 1]);
        assert.equal(signal.handlersAmount, 4);
    });

    void test('once::async', async t => {
        const signal = new Signal<string>();
        const waiter = new Waiter();
        const seen: string[] = [];
        const onceA = t.mock.fn<Handler<string>>(message => { seen.push(`a:${message}`); });
        const onceB = t.mock.fn<Handler<string>>(message => { seen.push(`b:${message}`); });
        const keep = t.mock.fn<Handler<string>>(message => {
            seen.push(`k:${message}`);
            waiter.done();
        });

        signal.once(onceA, true);
        signal.once(onceB, true);
        signal.sub(keep, true);

        signal.emit('one');
        await waiter.wait();

        assert.deepEqual(seen, ['a:one', 'b:one', 'k:one']);
        assert.strictEqual(signal.asyncHandlersAmount, 1);

        seen.splice(0, seen.length);
        waiter.restart();
        signal.emit('two');
        await waiter.wait();

        assert.deepEqual(seen, ['k:two']);
        assert.strictEqual(onceA.mock.callCount(), 1);
        assert.strictEqual(onceB.mock.callCount(), 1);
        assert.strictEqual(keep.mock.callCount(), 2);

        signal.destructor();
    });

    void test('unsub::last', t => {
        const signal = new Signal<void>();
        const fn = t.mock.fn();
        const missing = t.mock.fn();

        assert.strictEqual(signal.unsub(missing), false);

        signal.once(fn);
        assert.strictEqual(signal.unsub(fn), true);
        assert.strictEqual(signal.handlersAmount, 0);
        assert.strictEqual(signal.unsub(fn), false);

        signal.emit();
        assert.strictEqual(fn.mock.callCount(), 0);

        signal.destructor();
    });

    void test('unsub::async', async t => {
        const signal = new Signal<void>();
        const waiter = new Waiter();
        const syncFn = t.mock.fn();
        const asyncFn = t.mock.fn();
        const onceFn = t.mock.fn(() => { waiter.done(); });
        const keep = t.mock.fn();
        const missing = t.mock.fn();

        signal.sub(syncFn);
        signal.sub(keep, true);
        signal.once(onceFn, true);
        signal.sub(asyncFn, true);

        assert.strictEqual(signal.unsub(missing), false);
        assert.strictEqual(signal.unsub(asyncFn), true);
        assert.strictEqual(signal.unsub(keep), true);
        assert.strictEqual(signal.asyncHandlersAmount, 1);

        signal.emit();
        assert.strictEqual(syncFn.mock.callCount(), 1);
        await waiter.wait();

        assert.strictEqual(onceFn.mock.callCount(), 1);
        assert.strictEqual(asyncFn.mock.callCount(), 0);
        assert.strictEqual(keep.mock.callCount(), 0);
        assert.strictEqual(signal.asyncHandlersAmount, 0);
        assert.strictEqual(signal.unsub(onceFn), false);

        signal.destructor();
    });

    void test('unsubAll::once', t => {
        const signal = new Signal<void>();
        const keep = t.mock.fn();
        const onceFn = t.mock.fn();
        const drop = t.mock.fn();

        signal.sub(drop);
        signal.sub(keep);
        signal.once(onceFn);
        signal.sub(drop);

        assert.strictEqual(signal.unsubAll(drop), true);
        signal.emit();

        assert.strictEqual(keep.mock.callCount(), 1);
        assert.strictEqual(onceFn.mock.callCount(), 1);
        assert.strictEqual(drop.mock.callCount(), 0);
        assert.strictEqual(signal.handlersAmount, 1);

        signal.emit();
        assert.strictEqual(onceFn.mock.callCount(), 1);
        assert.strictEqual(keep.mock.callCount(), 2);

        assert.strictEqual(signal.unsubAll(keep), true);
        assert.strictEqual(signal.handlersAmount, 0);
        assert.strictEqual(signal.unsubAll(keep), false);

        signal.destructor();
    });

    void test('unsubAll::async', async t => {
        const signal = new Signal<void>();
        const waiter = new Waiter();
        const drop = t.mock.fn();
        const onceFn = t.mock.fn();
        const keep = t.mock.fn(() => { waiter.done(); });

        assert.strictEqual(signal.unsubAll(drop), false);

        signal.sub(drop, true);
        signal.once(onceFn, true);
        signal.sub(drop, true);
        signal.sub(keep, true);

        assert.strictEqual(signal.unsubAll(drop), true);
        assert.strictEqual(signal.asyncHandlersAmount, 2);

        signal.emit();
        await waiter.wait();

        assert.strictEqual(drop.mock.callCount(), 0);
        assert.strictEqual(onceFn.mock.callCount(), 1);
        assert.strictEqual(keep.mock.callCount(), 1);
        assert.strictEqual(signal.asyncHandlersAmount, 1);

        signal.once(drop, true);
        signal.once(drop, true);
        assert.strictEqual(signal.unsubAll(drop), true);
        assert.strictEqual(signal.asyncHandlersAmount, 1);

        assert.strictEqual(signal.unsubAll(keep), true);
        assert.strictEqual(signal.asyncHandlersAmount, 0);

        signal.destructor();
    });

    void test('watch', async t => {
        const signal = new Signal<void>();
        const waiter = new Waiter();
        const syncFn = t.mock.fn();
        const asyncFn = t.mock.fn(() => { waiter.done(); });

        const stopSync = signal.watch(syncFn);
        const stopAsync = signal.watch(asyncFn, true);

        signal.emit();
        assert.strictEqual(syncFn.mock.callCount(), 1);
        await waiter.wait();
        assert.strictEqual(asyncFn.mock.callCount(), 1);

        stopSync();
        stopAsync();
        assert.strictEqual(signal.handlersAmount, 0);

        signal.emit();
        assert.strictEqual(syncFn.mock.callCount(), 1);
        assert.strictEqual(asyncFn.mock.callCount(), 1);

        signal.destructor();
    });

    void test('order::sub', t => {
        Signal.orderSafe = false;

        const signal = new Signal();
        const added = t.mock.fn();
        signal.sub(() => { signal.sub(added); });
        signal.emit();
        assert.strictEqual(added.mock.callCount(), 1);

        Signal.orderSafe = true;

        const signalSafe = new Signal();
        const addedSafe = t.mock.fn();
        signalSafe.sub(() => { signalSafe.sub(addedSafe); });
        signalSafe.emit();
        assert.strictEqual(addedSafe.mock.callCount(), 0);
        signalSafe.emit();
        assert.strictEqual(addedSafe.mock.callCount(), 1);

        Signal.orderSafe = Signal.defaultOrderSave;
        signal.destructor();
        signalSafe.destructor();
    });

    void test('unsub::once', t => {
        const signal = new Signal<void>();
        const onceFn = t.mock.fn();
        const keep = t.mock.fn();

        signal.once(onceFn);
        signal.sub(keep);
        assert.strictEqual(signal.unsub(onceFn), true);

        signal.emit();
        assert.strictEqual(onceFn.mock.callCount(), 0);
        assert.strictEqual(keep.mock.callCount(), 1);

        signal.emit();
        assert.strictEqual(keep.mock.callCount(), 2);

        signal.destructor();
    });

    void test('unsub::async::once', async t => {
        const signal = new Signal<void>();
        const waiter = new Waiter();
        const onceFn = t.mock.fn();
        const keep = t.mock.fn(() => { waiter.done(); });

        signal.once(onceFn, true);
        signal.sub(keep, true);
        assert.strictEqual(signal.unsub(onceFn), true);

        signal.emit();
        await waiter.wait();
        assert.strictEqual(onceFn.mock.callCount(), 0);
        assert.strictEqual(keep.mock.callCount(), 1);

        waiter.restart();
        signal.emit();
        await waiter.wait();
        assert.strictEqual(keep.mock.callCount(), 2);

        signal.destructor();
    });

    void test('unsubAll::once::clear', t => {
        const signal = new Signal<void>();
        const keep = t.mock.fn();
        const drop = t.mock.fn();

        signal.sub(keep);
        signal.once(drop);
        signal.once(drop);
        assert.strictEqual(signal.unsubAll(drop), true);

        signal.emit();
        assert.strictEqual(drop.mock.callCount(), 0);
        assert.strictEqual(keep.mock.callCount(), 1);

        signal.destructor();
    });
});

function testOrder (t: TestContext, should: boolean) {
    const signal = new Signal();

    const handler1 = t.mock.fn();
    const handler2 = t.mock.fn();
    signal.sub(() => {
        signal.unsub(handler1);
    });
    signal.sub(handler1);
    signal.sub(handler2);

    signal.emit();

    assert.equal(handler1.mock.callCount(), should ? 1 : 0);
    assert.equal(handler2.mock.callCount(), 1);

    signal.destructor();
}

function testException (t: TestContext, should: boolean) {
    const signal = new Signal();

    const handler1 = t.mock.fn();
    const handler2 = t.mock.fn();
    signal.sub(handler1);
    signal.sub(() => {
        throw new Error();
    });
    signal.sub(handler2);

    if (!should)
        assert.throws(signal.emit.bind(signal), Error);
    else
        signal.emit();

    assert.equal(handler1.mock.callCount(), 1);
    assert.equal(handler2.mock.callCount(), should ? 1 : 0);

    signal.destructor();
}