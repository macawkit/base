# Macaw Kit Base
Base classes and common utils for Macaw Kit

## About
This project provides utilities to be reused in Macaw Kit projects.

### Classes:
- `Base` - A base class for any significant enough object to have a lifecycle.
- `Signal` - An entity that emits messages to listeners.
- `FSM` - A finite state machine. Transitions are signals.
- `Waiter` - A tool to `await` some `async` callback from elsewhere.

### Errors:
- `UseAfterFree` - Error thrown by a `@NoUseAfterFree`-protected method if it is called after `Base::destructor`.

### Functions:
- `sleep` - A useful function to `await` for some time.
- `compare` - Deep equality for values, including objects, collections, and binary data.
- `compareArray`, `compareMap`, `compareSet`, `compareObject`, `compareBinary` - The same checks when the kind of value is already known.
- `keyExist` - Whether a `Map` or `Set` contains a deep-equal key.
- `find` - The value stored under a deep-equal `Map` key.
- `isRecord` - Whether a value is an object `compare` treats as a record.

### Decorators:
- `NoUseAfterFree` - A standard decorator for a class or a method. It protects methods from being called after `Base::destructor`.

### Types:
- `Timeout` - Return type of `setTimeout`, safe to use in the browser and in Node.
- `Handler` - Function called by `Signal` with the emitted message.
- `Class` - Constructor type.
- `Method` - Method type with an explicit `this`.
- `FSMChangeEvent` - `{ from, to, event }` delivered by `FSM`.

## Usage

### Base
`Base` is designed to be a base class for significant objects:
models, controllers, UI elements, observers, etc.
Using `Base` on stateless message-like objects, such as `class Point {x: number; y: number}`,
would probably be overkill.

The main feature is the finalizing method `Base::destructor`,
in which you should undo everything done during the object's lifetime.
When an application is large enough, it's easier to have finalizers in all objects to prevent memory and resource leaks.

To use `Base`, simply `extend` it.
There is only one rule: if you override `destructor`, mark it with `override` and call `super.destructor` within it.

```typescript
import { Base, type Timeout } from '@macawkit/base';

class MyClass extends Base {
    private timeout: Timeout;

    constructor (interval: number) {
        super();

        this.timeout = setTimeout(() =>
            console.log('Are we there yet?'), interval);
    }

    override destructor (): void {
        clearTimeout(this.timeout);

        super.destructor();
    }
}
```

After `Base::destructor` has been called, the instance should no longer be used.
`destructor` deletes the instance's own properties, so the garbage collector can drop it
together with whatever resources those properties were holding.
`Base::destroyed` stays `true`.
`Base::className` still returns the constructor name, because that getter lives on the prototype.
`Base::id`, and any other own field, is gone.

There is no check to see if any method is actually being called on a destroyed object,
because this would have a slight performance tradeoff.
However, you may use the `@NoUseAfterFree` decorator to address this issue.
It is a standard decorator, so the project does not need `experimentalDecorators`.
It works as a class decorator, protecting all methods of the current class (**not the parent class!**).
It also works as a method decorator, in case you want to protect only specific methods.
If any decorator-protected method is called on a destroyed object, a `UseAfterFree` error is thrown,
allowing you to address the lifecycle error that caused this situation.
The error exposes `className` and `method`, the same names used in its message.

`Base::id` is a unique stable id assigned to every instance.
`Base::className` is the name of the constructor that created the instance.

### Signal
`Signal` is a utility class designed to deliver messages from a single object
to an unknown group of handlers outside the class. Let me illustrate it with an example:

```typescript
import { Base, Signal } from '@macawkit/base';

class Progress extends Base {
    // Declare the signals your object emits
    public started = new Signal();
    // Signals may deliver messages, but can be empty
    public updated = new Signal<number>();
    // Expose signals as part of your class API
    public finished = new Signal();

    private progress = 0;

    constructor () {
        super();
    }

    override destructor (): void {
        this.finished.destructor();
        this.updated.destructor();
        this.started.destructor();

        super.destructor();
    }

    public step (): void {
        // Emit signals when your object meets some internal conditions
        if (this.progress === 0)
            this.started.emit();
        else if (this.progress >= 1)
            return;

        this.progress += 0.1;
        // Deliver messages with the signals
        this.updated.emit(this.progress);

        if (this.progress >= 1)
            this.finished.emit();
    }
}

function log (fraction: number) {
    console.log(`Progress: ${fraction * 100}%`);
}

const progress = new Progress();
const id = setInterval(() => progress.step(), 100);

// Subscribe to signals you're interested in
progress.updated.sub(log);
// Subscribe to be called only once
progress.finished.once(() => {
    clearInterval(id);
    // Unsubscribe when you're no longer interested
    progress.updated.unsub(log);
});
```
As you can see, `Signal` behaves much like `EventEmitter` from `node.js`,
but it doesn't have event names and can have only one parameter.
This is intentional, as it requires the developer to declare signals upfront, with the types of messages they deliver.
IDE syntax highlighting will also suggest available signals of the current object and
validate the types of handlers used with them.

The handler type is `Handler<T>`. For a `Signal<number>` that is `(message: number) => void`.
A `Signal` with no type argument delivers no message (`Signal<void>`), and `emit()` is called with no argument.

Just like `EventEmitter`, by default `Signal` delivers messages synchronously.
Pass `true` as the second argument of `Signal::sub` or `Signal::once` to deliver that handler asynchronously.
Asynchronous handlers are still called if `Signal` was destroyed after the message was already emitted.
`Signal::destructor` drops the pending timer and schedules whatever messages were already queued.

The same function may be subscribed more than once. Each subscription is delivered separately.
`Signal::unsub` removes a single subscription and returns `true` when it found one.
`Signal::unsubAll` removes every subscription of that function, on both the sync and async queues, and returns `true` when it removed any.
`Signal::watch` subscribes and returns a function that removes that one subscription:

```typescript
const stop = progress.updated.watch(log);
stop();
```

`Signal::handlersAmount` is the number of current handlers.
`Signal::syncHandlersAmount` and `Signal::asyncHandlersAmount` split that count by queue.

There are two performance tradeoffs about `Signal` you should know about.

First is ***exception safety***. By default, if any handler throws an error, `Signal` won't catch it.
Moreover, the exception will stop handlers further down the queue from being executed.
However, you can alter this behavior by setting a static variable of `Signal`:
```typescript
Signal.exceptionSafe = true;
```
This will make signals execute every handler within a `try { ... } catch { ... }` block.
All exceptions will be ignored, so later handlers still run.
`Signal.defaultExceptionSafe` is the original value, `false`.

The second is ***order safety***. To maximize performance, by default, `Signal` executes
handlers from the queue, assuming the queue will not change in the middle of execution.
This means you may face issues like unsubscribing a handler and accidentally stopping it from being executed,
or even corrupting the event queue. These events are rare unless your application relies heavily on order purity.
If you face these issues, you can enable ***order safety*** like this:
```typescript
Signal.orderSafe = true;
```
This will make all signals copy the handlers queue before executing handlers from it.
`Signal.defaultOrderSave` is the original value, `false`.

Async handlers are flushed through `setTimeout`. `Signal.delay` is that delay in milliseconds, and the default is `0`.
`Signal.defaultDelay` is that original value, so you can put the delay back after changing it:
```typescript
Signal.delay = 20;
Signal.delay = Signal.defaultDelay;
```

### FSM
`FSM` is a small state machine. You list every state and the events that leave it.
The machine starts in the state you name, and `dispatch` follows one edge.

```typescript
import { FSM } from '@macawkit/base';

const job = new FSM([
    ['idle', [['start', 'work']]],
    ['work', [['step', 'work'], ['finish', 'done']]],
    ['done', []]
], 'idle');

job.beforeChange.sub(event => {
    // `state` is still `event.from`
    console.log(`${event.from} -${event.event}-> ${event.to}`);
});
job.change.sub(event => {
    // `state` is already `event.to`
    console.log(job.state);
});

job.dispatch('finish'); // idle has no finish, so this does nothing
job.dispatch('start');  // idle -> work
job.dispatch('finish'); // work -> done
```

The graph is a list of `[state, transitions]`. Each transition is `[event, nextState]`.
State and event names are strings, and an empty name is rejected.
A state may appear only once, and a state may list each event only once.
Every next state has to be declared in the graph, and the initial state has to be one of them.
The constructor throws when any of those rules is broken.

`FSM::state` is the current state.
`FSM::dispatch` leaves the machine where it is when the current state has no transition for that event.
`FSM::beforeChange` is emitted before the move, and `FSM::change` is emitted after it.
Both are `Signal`s. They deliver an `FSMChangeEvent`: `{ from, to, event }`.

A listener may call `dispatch` again. The new event runs after the current transition, and before the original `dispatch` returns.
If a listener throws, the error is written to the console and the transition still happens.
Further listeners of that same emission follow the usual `Signal` rules, so they are skipped unless `Signal.exceptionSafe` is on.

`FSM` extends `Base`. `FSM::destructor` destroys `beforeChange` and `change`, then finalizes the machine.

### Waiter
`Waiter` is a small latch. `wait` returns a promise that settles when something else calls `done`.
`restart` arms it again, so the same waiter can be used for the next event.

```typescript
import { Waiter } from '@macawkit/base';

const waiter = new Waiter();

setTimeout(() => waiter.done(), 20);
await waiter.wait();

waiter.restart();
setTimeout(() => waiter.done(), 20);
await waiter.wait();
```

### sleep
`sleep` returns a promise that settles after the given number of milliseconds.

```typescript
import { sleep } from '@macawkit/base';

await sleep(20);
```

### compare
`compare` checks whether two values are deeply equal.
The same value is equal to itself. `0` and `-0` are equal, and so are two `NaN`s.
A function or a symbol is equal only to that same value.
Values of different types are unequal, and `null` is equal only to `null`.

```typescript
import { compare, find, keyExist } from '@macawkit/base';

compare({ id: 1, tags: ['a'] }, { tags: ['a'], id: 1 }); // true
compare(new Date(0), new Date(0)); // true
compare(/a/gi, /a/ig); // true

const rows = new Map<unknown, string>([[{ id: 1 }, 'first']]);

keyExist(rows, { id: 1 }); // true
find(rows, { id: 1 }, 'missing'); // 'first'
find(rows, { id: 2 }, 'missing'); // 'missing'
```

Dates are compared by time. Two invalid dates are equal.
Regular expressions are compared by source and flags. `lastIndex` stays out of the comparison.
Arrays are compared by index, in order. Named properties on an array are left out.
Maps and sets are compared member by member, in any order. The comparison is deep, and each member is paired only once.
`ArrayBuffer`s, `DataView`s, and typed arrays are compared by the bytes they cover.
An `ArrayBuffer`, a `DataView`, and a typed array stay distinct from each other even when the bytes match.
Two typed arrays can still be equal across classes when those bytes match.

Any other object is compared by constructor and by its own enumerable keys.
Key order does not matter, and inherited properties are left out.
Two instances of the same class can be equal.
A class instance stays distinct from a plain object with the same fields.

`compareArray`, `compareMap`, `compareSet`, `compareObject`, and `compareBinary` perform those same checks.
Call one of them when the kind of value is already known.
`compareBinary(a, b, fallback)` returns `fallback` when `a` is not binary.
When `a` is binary and `b` is not, or the two values are different binary kinds, the result is `false`.

`keyExist` reports whether a `Map` or a `Set` contains a deep-equal key.
`find(map, key, fallback)` returns the value of the first deep-equal key, or `fallback` when none matches.
`isRecord` is true for plain objects and class instances.
It is false for `null`, arrays, dates, regular expressions, maps, sets, and binary values.

For more examples and use cases, you may refer to the `test` directory.
