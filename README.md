# Macaw Kit Base
Base classes and common utils for Macaw Kit

## About
This project provides utilities to be reused in Macaw Kit projects.

### Classes:
- `Base` - A base class for any significant enough object to have a lifecycle.
- `Signal` - An entity that emits messages to listeners.
- `Waiter` - A tool to `await` some `async` callback from elsewhere.

### Errors:
- `UseAfterFree` - Error thrown if an heir of `Base` is used after `Base::destructor` has been called.

### Functions:
- `sleep` - A useful function to `await` for some time.

### Decorators:
- `NoUseAfterFree` - A decorator for a class or method that protects methods from being called after `Base::destructor` has been called.

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
There is only one rule: if you override `destructor`, call `super.destructor` within it.

```typescript
import { Base, Timeout } from '@macawkit/base';

class MyClass extends Base {
    private timeout: Timeout

    constructor (interval: number) {
        super();
        
        this.interval = setInterval(() => 
            console.log('Are we there yet?'), interval);
    }

    destructor () {
        clearInterval(this.interval);
        
        super.destructor();
    }
}
```

After `Base::destructor` has been called, the instance should no longer be used.
Such an instance will have all its properties removed, and only `Base::destroyed` will return `true`.
This way, the garbage collector will easily remove this object, as it is not held by any allocated resource.
Any properties of this object should also be removed with ease.

There is no check to see if any method is actually being called on a destroyed object,
because this would have a slight performance tradeoff.
However, you may use the `@NoUseAfterFree` decorator to address this issue.
It works as a class decorator, protecting all methods of the current class (**not the parent class!**).
It also works as a method decorator, in case you want to protect only specific methods.
If any decorator-protected method is called on a destroyed object, a `UseAfterFree` error is thrown,
allowing you to address the lifecycle error that caused this situation.

Base also has a `Base::id` getter, which provides a unique stable ID for every instance of `Base`.

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

    destructor (): void {
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
IDE syntax highlighting will also suggest available signals of current object and 
validate types of handlers programmer uses them with.

Just like `EventEmitter`, by default `Signal` delivers messages synchronously, but you can easily change that
by passing `true` as the second argument to `Signal::sub` method.
Note that asynchronous handlers will be called even after
`Signal` has already emitted an event but has been destroyed.

There are two performance tradeoffs about `Signal` you should know about.

First is ***exception safety***. By default, if any handler throw an error, `Signal` won't catch it.
Moreover, the exception will stop handlers further down the queue from being executed.
However, you can alter this behavior by setting a static variable of `Signal`:
```typescript
Signal.exceptionSafe = true;
```
This will enable signals to execute every handler within a `try { ... } catch (e) { ... }` block.
All exceptions will be ignored, but this ensures handlers are executed in the correct order even if an exception occurs.

The second is ***order safety***. To maximize performance, by default, `Signal` executes
handlers from the queue, assuming the queue will not change in the middle of execution.
This means you may face issues like unsubscribing a handler and accidentally stopping it from being executed,
or even corrupting the event queue. These events are rare unless your application relies heavily on order purity.
If you face these issues, you can enable ***order safety*** like this:
```typescript
Signal.orderSafe = true;
```
This will make all signals copy the handlers queue before executing handlers from it.

For more examples and use cases, you may refer to the `test` directory.