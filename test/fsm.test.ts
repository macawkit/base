/* node:coverage disable */
import { describe, test } from 'node:test';
import assert from 'node:assert';

import { FSM, Signal, Waiter } from '../src';

function job () {
    return new FSM([
        ['idle', [['start', 'work']]],
        ['work', [['step', 'work'], ['finish', 'done']]],
        ['done', []]
    ], 'idle');
}

void describe('FSM', () => {
    void test('dispatch', () => {
        const fsm = job();
        const log: string[] = [];
        const onChange = (event: { event: string; to: string }) => {
            assert.strictEqual(fsm.state, event.to);
            log.push(`change ${event.event} ${fsm.state}`);
        };

        fsm.beforeChange.sub(event => {
            assert.strictEqual(fsm.state, event.from);
            log.push(`before ${event.event} ${fsm.state}`);
        });
        fsm.change.sub(onChange);

        fsm.dispatch('finish');
        fsm.dispatch('step');
        assert.deepStrictEqual(log, []);
        assert.strictEqual(fsm.state, 'idle');

        fsm.dispatch('start');
        fsm.dispatch('step');
        fsm.change.unsub(onChange);
        fsm.dispatch('finish');
        fsm.dispatch('start');

        assert.deepStrictEqual(log, [
            'before start idle',
            'change start work',
            'before step work',
            'change step work',
            'before finish work'
        ]);
        assert.strictEqual(fsm.state, 'done');
    });

    void test('dispatch::from a listener', () => {
        const fsm = job();
        const log: string[] = [];
        let stepped = false;

        fsm.beforeChange.sub(event => {
            log.push(`before ${event.event} ${event.from} -> ${event.to} in ${fsm.state}`);
            if (event.event !== 'start')
                return;

            // 'start' is not legal once we have left idle. 'step' is.
            fsm.dispatch('start');
            fsm.dispatch('step');
        });
        fsm.change.sub(event => {
            log.push(`change ${event.event} ${event.from} -> ${event.to} in ${fsm.state}`);
            if (event.event !== 'step' || stepped)
                return;

            stepped = true;
            fsm.dispatch('step');
        });

        fsm.dispatch('start');
        assert.strictEqual(fsm.state, 'work');

        fsm.dispatch('finish');
        assert.strictEqual(fsm.state, 'done');
        assert.deepStrictEqual(log, [
            'before start idle -> work in idle',
            'change start idle -> work in work',
            'before step work -> work in work',
            'change step work -> work in work',
            'before step work -> work in work',
            'change step work -> work in work',
            'before finish work -> done in work',
            'change finish work -> done in done'
        ]);
    });

    void test('dispatch::listener throws', t => {
        Signal.exceptionSafe = false;
        const logged: unknown[][] = [];
        t.mock.method(console, 'error', (...args: unknown[]) => {
            logged.push(args);
        });
        const beforeError = new Error('before');
        const changeError = new Error('change');

        try {
            const fsm = job();
            const beforeRest: string[] = [];
            const changeRest: string[] = [];

            fsm.beforeChange.sub(event => {
                if (event.event !== 'start')
                    return;

                fsm.dispatch('step');
                throw beforeError;
            });
            fsm.beforeChange.sub(event => {
                beforeRest.push(event.event);
            });
            fsm.change.sub(event => {
                if (event.event !== 'start')
                    return;

                fsm.dispatch('step');
                throw changeError;
            });
            fsm.change.sub(event => {
                changeRest.push(event.event);
            });

            fsm.dispatch('start');

            assert.strictEqual(fsm.state, 'work');
            assert.deepStrictEqual(beforeRest, ['step', 'step']);
            assert.deepStrictEqual(changeRest, ['step', 'step']);
            assert.deepStrictEqual(logged, [
                ['Error in beforeChange event of the FSM:', beforeError],
                ['Error in change event of the FSM:', changeError]
            ]);

            fsm.dispatch('finish');
            assert.strictEqual(fsm.state, 'done');
        } finally {
            Signal.exceptionSafe = Signal.defaultExceptionSafe;
        }
    });

    void test('dispatch::async listener', async () => {
        const fsm = job();
        const waiter = new Waiter();

        fsm.change.sub(event => {
            if (event.event !== 'start')
                return;

            fsm.dispatch('finish');
            waiter.done();
        }, true);

        fsm.dispatch('start');
        assert.strictEqual(fsm.state, 'work');

        fsm.dispatch('step');
        assert.strictEqual(fsm.state, 'work');

        await waiter.wait();
        assert.strictEqual(fsm.state, 'done');
    });

    void test('constructor', () => {
        const fsm = new FSM([
            ['work', [['finish', 'idle']]],
            ['idle', [['start', 'work']]]
        ], 'idle');

        assert.strictEqual(fsm.state, 'idle');
        fsm.dispatch('start');
        assert.strictEqual(fsm.state, 'work');
        fsm.dispatch('finish');
        assert.strictEqual(fsm.state, 'idle');

        assert.throws(() => new FSM([
            ['', [['go', 'next']]],
            ['next', []]
        ], ''), { message: 'Empty state names are not allowed' });

        assert.throws(() => new FSM([
            ['idle', [['', 'idle']]]
        ], 'idle'), { message: 'Empty event names are not allowed' });

        assert.throws(() => new FSM([
            ['idle', [['start', 'work'], ['start', 'idle']]],
            ['work', []]
        ], 'idle'), { message: 'Duplicate event: start for state: idle' });

        assert.throws(() => new FSM([
            ['idle', [['start', 'work']]],
            ['work', []],
            ['idle', [['start', 'work']]]
        ], 'idle'), { message: 'Duplicate state: idle' });

        assert.throws(() => new FSM([
            ['idle', []]
        ], 'missing'), { message: 'Initial state missing not found in graph' });

        assert.throws(() => new FSM([], 'idle'), { message: 'Initial state idle not found in graph' });

        assert.throws(() => new FSM([
            ['idle', [['start', 'work']]]
        ], 'idle'), { message: 'Next state work not found in graph' });
    });

    void test('destructor', () => {
        const fsm = job();
        const other = job();
        const change = fsm.change;
        const beforeChange = fsm.beforeChange;

        assert.strictEqual(fsm.className, fsm.constructor.name);
        assert.notStrictEqual(fsm.id, other.id);

        let heard = 0;
        const hear = () => {
            heard += 1;
        };
        change.sub(hear);
        beforeChange.sub(hear);
        fsm.dispatch('start');
        assert.strictEqual(heard, 2);

        fsm.destructor();

        assert.strictEqual(fsm.destroyed, true);
        assert.strictEqual(fsm.className, fsm.constructor.name);
        assert.strictEqual(fsm.state, undefined);
        assert.strictEqual(change.destroyed, true);
        assert.strictEqual(beforeChange.destroyed, true);
        assert.strictEqual(other.state, 'idle');
    });
});
