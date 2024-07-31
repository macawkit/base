/* node:coverage disable */
import { describe, test, TestContext } from 'node:test';
import assert from 'node:assert';

import Signal from '../src/signal';
import { Handler, Waiter } from '../src';

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

        signal.unsubAll(fn);
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
        let duration: number;

        signal.sub(start => {
            duration = Date.now() - start;
            waiter.done();
        }, true);

        signal.emit(Date.now());
        await waiter.wait();

        assert.equal(duration! >= 0, true); //default delay one is set to 0, but it is passed to setTimeout
        assert.equal(duration! <= 5, true);  //and some engines have default timeout delay 4 ms even if 0 is passed

        Signal.delay = 20;
        waiter.restart();
        signal.emit(Date.now());
        await waiter.wait();

        assert.equal(duration! > 19, true);
        assert.equal(duration! <= 21, true);

        Signal.delay = Signal.defaultDelay;
        waiter.restart();
        signal.emit(Date.now());
        await waiter.wait();

        assert.equal(duration! >= 0, true);
        assert.equal(duration! < 5, true);
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