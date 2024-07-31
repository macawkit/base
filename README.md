# Macaw Kit Base
Base classes and common utils for Macaw Kit

## About
This project provides some utilities to be reused in Macaw Kit projects.

### Classes:
- `Base` - a base class for any significant enough object to have a lifecycle
- `Signal` - an entity that emits messages to listeners
- `Waiter` - a tool to `await` for some async callback from somewhere else

### Errors:
- `UseAfterFree` - error thrown if an heir of `Base` have been used after `Base::destructor` have been called

### Functions:
- `sleep` - useful function to `await` for some time

### Decorators:
- `NoUseAfterFree` - a decorator for class or for a method that would protect methods from being called after `Base::destructor` have been called 

## Usage

### Base
Base is designed to ba a base class for significant enough objects: 
models, controllers, UI elements, observers and so on. 
Using base on stateless message-like objects, say `class Point {x: number; y: number}` would be an overkill. 

The main idea is the finalizing method `Base::destructor`, 
in which you should undo everything you've done during your object lifetime.
When an application is large enough it's easier to have finalizers in all objects to prevent memory and resource leaks.

To use Base - just `extend` it. There is only one rule: if you override `destructor` - call there `super.destructor`

```typescript
import { Timeout } from './utils';

class MyClass extends Base {
    private timeout: Timeout

    constructor (interval: number) {
        super();

        this.interval = setInterval(() => 
            console.log('Are we there yet?'), 5)
    }

    destructor () {
        clearInterval(this.interval);

        super.destructor();
    }
}
```

After `Base::destructor` have been the instance no longer should be used. 
Such instance will have all the properties removed, and only `Base::destroyed` shall return `true`. 
This way garbage collector will easily remove this object, because he is not held by any allocated resource. 
Any properties of this object should also be removed with ease. 

There is no check if any method is actually being called on destroyed object, 
because this would have a little performance tradeoff. 
However, you may `@NoUseAfterFree` decorator to address this issue. 
It works as a class decorator, this way it protects all the methods of current class (not parent!).
Also, it works as a method decorator, in case you, for example would like to protect only public methods.
If any of decorator protected method is called on destroyed object an `UseAfterFree` is thrown, 
so you can find address a lifecycle error that caused this situation.

Base also have `Base::id` getter, it will provide a unique stable ID for every instance of `Base`.

### Signal
TODO