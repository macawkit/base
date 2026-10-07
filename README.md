# Macaw Kit Base
Base classes and common utils for Macaw Kit

## About
This project provides utilities to be reused in Macaw Kit projects.

### Classes:
- `Base` - A base class for any significant enough object to have a lifecycle.
- `Signal` - An entity that emits messages to listeners.
- `Waiter` - A tool to `await` some `async` callback from elsewhere.

### Errors:
- `UseAfterFree` - Error thrown by a `@NoUseAfterFree`-protected method if it is called after `Base::destructor`.

### Functions:
- `sleep` - A useful function to `await` for some time.

### Decorators:
- `NoUseAfterFree` - A standard decorator for a class or a method. It protects methods from being called after `Base::destructor`.

### Types:
- `Timeout` - Return type of `setTimeout`, safe to use in the browser and in Node.
- `Handler` - Function called by `Signal` with the emitted message.
- `Class` - Constructor type.
- `Method` - Method type with an explicit `this`.

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

For more examples and use cases, you may refer to the `test` directory.
