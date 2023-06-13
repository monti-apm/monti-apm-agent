## How Async Hooks work

Async Hooks is a module in Node.js that provides an API to track asynchronous resources in your application. This is crucial when building and maintaining large-scale applications, as it allows developers to understand what's happening under the hood of their asynchronous operations, providing a deeper level of insight into the event loop, promises, and other asynchronous behaviors.

Here's a basic rundown of how Async Hooks works:

- **Initialization** (`init`): This is the first step in the life cycle of an async operation. When an async operation is initialized, the init hook is called. This hook function receives several arguments: the unique id of the async operation, the type of the operation (e.g., 'TIMERWRAP', 'PROMISE', etc.), the id of the parent async operation (which caused the current operation), and the resource object.

- **Before** (`before`): Just before the async operation's callback is about to be called, the before hook is invoked. The callback receives the id of the async operation.

- **After** (`after`): Just after the async operation's callback has finished, the after hook is invoked. Like the before hook, it also receives the id of the async operation.

- **Destruction** (`destroy`): When the async operation is about to be garbage collected, the destroy hook is invoked. This hook receives the id of the async operation.

- **Promise Resolve** (`promiseResolve`): This is a special hook that is invoked when a Promise-based operation is resolved. It receives the id of the async operation.

To use Async Hooks, you need to create a hooks object with the desired lifecycle hooks, and then call `async_hooks.createHook(hooks)` to create a new AsyncHooks instance. This instance has `enable()` and `disable()` methods to start and stop the tracking of async operations.

## Clarification on the `destroy` hook

The `destroy` hook in Node.js's Async Hooks API is called when an asynchronous resource is about to be garbage collected, not necessarily immediately after the resource's work has completed.

It's important to understand that in JavaScript, and Node.js in particular, the timing of garbage collection is not guaranteed. The JavaScript engine decides when to perform garbage collection based on a variety of factors, including memory pressure and CPU usage. This means that there can be a delay between when an async resource's work is finished and when the `destroy` hook is called.

So while the `destroy` hook can give you an indication that an async resource is no longer in use and is about to be cleaned up, it's not a reliable way to determine exactly when the resource's work has finished. For that, you would typically use the `after` hook, which is called immediately after the callback associated with an async operation has completed.

In the case of Promise-based async operations, like those created with `then` or `catch`, the `destroy` hook would typically be called sometime after the Promise has settled (i.e., either resolved or rejected) and the associated callbacks have run. But the exact timing would depend on when the JavaScript engine decides to perform garbage collection.

## The Promise executor function is called synchronously

When you create a new Promise, you provide a function as an argument. This function is often referred to as the "executor function". The executor function takes two arguments: a `resolve` function and a `reject` function.

Here's an example:

```javascript
new Promise((resolve, reject) => {
  // This is the executor function
});
```

The executor function is called immediately, synchronously when the Promise is created. This is by design, as it allows you to start any asynchronous operations needed to eventually resolve or reject the Promise. However, the Promise itself doesn't resolve or reject until you call the provided `resolve` or `reject` function, and that can happen synchronously or asynchronously depending on your code.

Because the executor function is called synchronously, if you call `async_hooks.executionAsyncId()` inside the executor function, it will return the async ID of the current synchronous execution context, not the async ID of the Promise itself. This can be misleading if you're trying to track the async ID of the Promise.

Here's an example that illustrates this:

```javascript
const async_hooks = require('async_hooks');

new Promise((resolve, reject) => {
  console.log(async_hooks.executionAsyncId());  // Logs the async ID of the current synchronous execution context
  setTimeout(resolve, 1000);  // Resolve the Promise asynchronously after 1 second
});
```

In this example, the `console.log` statement is executed synchronously when the Promise is created, so it logs the async ID of the current synchronous execution context. The Promise is then resolved asynchronously after 1 second by the `setTimeout` call.

To get the async ID of the Promise itself, you would need to use the `init` hook in the Async Hooks API, which is called when an async resource is created:

```javascript
const async_hooks = require('async_hooks');

async_hooks.createHook({
  init: (asyncId, type, triggerAsyncId) => {
    if (type === 'PROMISE') {
      console.log(asyncId);  // Logs the async ID of the Promise
    }
  }
}).enable();

new Promise((resolve, reject) => {
  setTimeout(resolve, 1000);  // Resolve the Promise asynchronously after 1 second
});
```

In this modified example, the `init` hook logs the async ID of the Promise when the Promise is created.

## Some promises do not call `before` or `after`

Async Hooks is a powerful feature in Node.js that allows developers to track the lifetime of asynchronous resources in a Node.js application. However, not all asynchronous operations are guaranteed to trigger Async Hooks events, including the before and after events.

Promises in particular can behave somewhat differently than other asynchronous resources in regards to Async Hooks.

The before and after events of async hooks correspond to the execution of a JavaScript callback function. If a Promise is resolved (or rejected) with a value that is not another Promise, and there are no `.then()` or `.catch()` handlers registered on it by the end of the current "tick" of the event loop, then no JavaScript callback is ever executed for that Promise. As a result, no before or after events would be emitted by Async Hooks for that Promise.

This is because the Promise implementation in JavaScript engines is optimized to avoid unnecessary operations when possible. If a Promise is resolved and no handlers are registered on it, the engine may decide not to queue any microtask for that Promise, since doing so would have no observable effect. Since Async Hooks hooks into the Node.js event loop and not the JavaScript engine itself, it would not see any activity for such Promises.

> So in short, if you're seeing some Promises not triggering before or after events in Async Hooks, it could be because those Promises are being resolved without any handlers registered on them.

Keep in mind that the behavior of Async Hooks and Promises can be complex and may vary between different versions of Node.js and different JavaScript engines, so it's possible there may be other factors at play as well.

## All promises trigger `promiseResolve`, except when they are rejected

The `promiseResolve` hook in Node.js's Async Hooks API is called when a Promise has been resolved, that is when the Promise has completed its work and has a result ready. This happens regardless of how the Promise was created or used.

Here's a simple example:

```javascript
const async_hooks = require('async_hooks');

async_hooks.createHook({
  promiseResolve: (asyncId) => {
    console.log(`Promise resolved with id ${asyncId}`);
  },
}).enable();

Promise.resolve(42);
```

In this code, a Promise is created and immediately resolved with the value `42`. The `promiseResolve` hook is called when this Promise is resolved, and logs a message with the async ID of the Promise.

> It's important to note that the `promiseResolve` hook is not called when a Promise is rejected. If you want to track when Promises are rejected, you would typically need to attach a `catch` callback to the Promise and handle the rejection there.

## The `then` and `catch` callbacks create new async operations which trigger `before` and `after`

Promises in JavaScript provide `then` and `catch` methods for handling the resolution and rejection of the promise, respectively. These methods take callbacks that are called when the promise is resolved or rejected.

In the context of Async Hooks in Node.js, when you attach a `then` or `catch` callback to a promise, a new asynchronous operation is created. This means that the `init` hook is called when you attach the `then` or `catch` callback.

When the promise is resolved (for `then`) or rejected (for `catch`), and it's time to call the callback, the `before` hook is called. After the callback has been executed, the `after` hook is called.

Here's a simplified example:

```javascript
doSomethingAsync()  // `init` hook called here
  .then(result => {  // `init` hook called here for the `then` callback
    console.log(result);  // `before` hook called here, then `after` hook after console.log
  })  // `destroy` hook called here after the `then` callback is finished
  .catch(error => {  // `init` hook called here for the `catch` callback
    console.error(error);  // `before` hook called here, then `after` hook after console.error
  });  // `destroy` hook called here after the `catch` callback is finished
```

In this example, the `init`, `before`, and `after` hooks are called for the `doSomethingAsync` operation, as well as for the `then` and `catch` callbacks. The `destroy` hook is called after each operation is completed and the resource is about to be garbage collected.

Remember that the `then` and `catch` callbacks are associated with new async operations, not with the original promise. This means that they have their own async IDs and can be tracked independently in Async Hooks.

It's also worth noting that if the `then` or `catch` callbacks themselves return a promise or include an `await` expression, this would create additional async operations and trigger additional hook calls.

## The `before` and `after` hooks are called for `await` operations

When an `await` operation is encountered in an async function, the function is paused, and control is returned to the event loop, which can then process other tasks. This pausing of the function creates an asynchronous boundary. When the awaited promise is resolved, the function is resumed.

In the context of Async Hooks, when a new async operation is created (such as when a promise is awaited), the `init` hook is called. Then, just before the async operation's callback is called (i.e., just before the async function is resumed after an `await`), the `before` hook is called. Similarly, just after the callback has completed, the `after` hook is called.

If you have multiple `await` expressions in a row in an async function, each `await` creates a new async operation. So for each `await`, the `before` and `after` hooks are called when the function is paused and resumed. Here's a simplified view:

```javascript
async function example() {
  // Before any awaits - function is running synchronously
  await doSomething(); // `before` hook called here, then `after` hook when promise is resolved
  await doSomethingElse(); // `before` hook called here, then `after` hook when promise is resolved
  // After all awaits - function resumes running synchronously
}
```

In this example, the `before` and `after` hooks are called twice: once for each `await`.

Remember that the `before` and `after` hooks are associated with the async operations, not directly with the `await` keyword. Any operation that creates a new async operation (which includes any operation that returns a promise) will trigger the `before` and `after` hooks. The `await` keyword just makes it easy to create async operations by pausing and resuming async functions.

It's important to note that while the `before` and `after` hooks give you visibility into when async operations are starting and finishing, they don't necessarily provide information about what's happening inside those operations. For that, you would need to look at the code of the operations themselves or use other debugging tools.

## The last `await` also triggers `before` or `after` even though there is nothing else to do

The `before` and `after` hooks in Async Hooks are triggered around the execution of the callback associated with an asynchronous operation. In the case of `await`, the "callback" could be considered as the remaining part of the async function that follows the `await` expression.

When you use `await` on a promise, the part of the function that follows the `await` expression is effectively a callback that gets executed when the promise is resolved. So, even if an `await` expression is the last statement in an async function, it would still trigger the `before` and `after` hooks because there's still a "callback" to execute: the rest of the function (even if it's just the function's implicit `return` statement).

Here's a simplified example:

```javascript
async function example() {
  await doSomething();  // `before` hook called here, then `after` hook when promise is resolved
  await doSomethingElse();  // `before` hook called here, then `after` hook when promise is resolved
  await doOneLastThing();  // `before` hook called here, then `after` hook when promise is resolved
  // Implicit return statement here
}
```

In this example, the `before` and `after` hooks are called for each `await`, including the last one. Even though there's no explicit code after the last `await`, there's still an implicit `return` statement that ends the function, and the `after` hook would be called before this `return` statement.

That said, it's important to remember that the `before` and `after` hooks are a somewhat low-level feature that provide visibility into the execution of asynchronous operations. They can be useful for debugging and understanding the flow of execution in complex applications, but they don't necessarily provide a complete picture of what your code is doing.

## After each `await` there is a new Async Resource

When you use `await` in JavaScript (and thus in Node.js), you're essentially pausing the execution of async function and waiting for a Promise to be resolved or rejected. The function execution is resumed with the resolved value of the Promise, or throws an error if the Promise was rejected.

During the pause in execution, control is given back to the JavaScript runtime, which can go on to handle other tasks. This is what allows JavaScript to handle multiple tasks "at the same time" despite being single-threaded; while one async function is paused, waiting for a Promise, another function can run.

When you use `await`, a new async operation is created, which is why you see a new async resource for each `await` in Async Hooks. The operation is completed when the Promise that you're waiting for is resolved or rejected. The init hook in Async Hooks is called when the operation is created (i.e., when `await` is encountered), and the destroy hook is called when the operation is completed (i.e., when the Promise is resolved or rejected).

It's also worth noting that each `await` creates a new microtask. The JavaScript event loop handles tasks and microtasks differently: a new task can't start until the current task and all of its associated microtasks have completed. By creating a new microtask with each `await`, JavaScript ensures that async functions behave predictably: the function will always resume where it left off, even if other tasks or functions have run in the meantime.

> To summarize, each `await` results in a new async operation (and thus a new async resource in Async Hooks) because `await` pauses the execution of the current async function and allows the JavaScript runtime to handle other tasks. This new async operation is completed when the Promise that's being awaited is resolved or rejected. This mechanism allows JavaScript to handle multiple tasks "at the same time" despite being single-threaded.

## In an Async Function, the first section of the code up to the first `await` is actually synchronous

The execution of an Async Function (up to the first `await` expression) is indeed synchronous. When an async function is called, it runs synchronously until it encounters an `await` expression. At that point, it yields execution back to the caller and waits for the Promise to either resolve or reject.

Here's a simple example:

```js
async function example() {
    console.log('1. This is synchronous');
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('2. This is asynchronous');
}

console.log('Start');
example();
console.log('End');
```

When you run this code, you will see the following output:

```
Start
1. This is synchronous
End
2. This is asynchronous
```

The call to `example()` runs synchronously until it encounters the `await` expression, at which point it pauses and allows the rest of the synchronous code to run. Then, after the Promise resolves (after one second in this case), the async function resumes and runs the rest of its code.

## The first part of an Async Function has the same Async ID as the caller

The initial **synchronous** part of an async function (up to the first `await`) is executed in the same turn of the event loop as the calling code. This means it shares the same async context, so it has the same Async ID as the parent in the context of Node.js async hooks.

When the async function hits an `await` statement, a new asynchronous operation is created, and it will be given a new async id. This is why you see a different Async ID after an `await` statement.

To put it simply, everything in an async function before the first `await` is executed in the same context (and thus has the same Async ID) as the calling code. After an `await`, a new context (and a new Async ID) is created.
