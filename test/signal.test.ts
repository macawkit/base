/* node:coverage disable */
import { describe, test } from 'node:test';
import assert from "node:assert";

import Signal from '../src/signal';
import { Handler, Waiter } from '../src';

describe("Signal", t => {
    test("emit", t => {
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

        assert.throws(signal.emit, "An attempt to emit event on destroyed signal");
    });

    test("sub-unsub", t => {
        const signal = new Signal<void>();
        let result = false;
        const fn = t.mock.fn<Handler>(() => result = !result);

        signal.sub(fn);
        signal.sub(fn);
        signal.emit();
        assert.strictEqual(result, false);
        assert.strictEqual(fn.mock.callCount(), 2);

        signal.sub(fn)
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

    test("unsubAll", t => {
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

    test("message", t => {
        const signal = new Signal<number>();
        let result = 0;
        const fn = t.mock.fn<Handler<number>>(message => {result = message;});

        signal.sub(fn);
        signal.emit(7);
        assert.strictEqual(result, 7);
        assert.strictEqual(fn.mock.callCount(), 1);

        signal.destructor();
    });

    test('emit::async', async t => {
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

        await waiter.promise;

        assert.strictEqual(resultS, 'Done');
        assert.strictEqual(fnS.mock.callCount(), 1);

        assert.strictEqual(resultA, 'Done');
        assert.strictEqual(fnA.mock.callCount(), 1);

        assert.strictEqual(signal.syncHandlersAmount, 1);
        assert.strictEqual(signal.asyncHandlersAmount, 1);
        assert.strictEqual(signal.handlersAmount, 2);

        signal.destructor();
    });

    test('emit::async::2', async t => {
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

        await waiter.promise;

        assert.strictEqual(resultS, 'Really-Well-Done');
        assert.strictEqual(fnS.mock.callCount(), 3);

        assert.strictEqual(resultA, 'Really-Well-Done');
        assert.strictEqual(fnA.mock.callCount(), 3);

        signal.destructor();
    });

    test('delay', async t => {
        const signal = new Signal<number>();
        let waiter = new Waiter();
        let duration: number;

        signal.sub(start => {
            duration = Date.now() - start
            waiter.done();
        }, true);

        signal.emit(Date.now());
        await waiter.promise;

        assert.equal(duration! >= 0, true);      //default delay one is set to 0, but it is passed to setTimeout
        assert.equal(duration! < 5, true);      //and some engines have default timeout delay 4 ms even if 0 is passed

        Signal.delay = 20;
        waiter = new Waiter();
        signal.emit(Date.now());
        await waiter.promise;

        assert.equal(duration! > 19, true);
        assert.equal(duration! < 21, true);

        Signal.delay = Signal.defaultDelay;
        waiter = new Waiter();
        signal.emit(Date.now());
        await waiter.promise;

        assert.equal(duration! >= 0, true);
        assert.equal(duration! < 5, true);

    });
    test('order::unsafe', {todo: true});
    test('order::safe', {todo: true});
    test('exception::unsafe', {todo: true});
    test('exception::safe', {todo: true});
})