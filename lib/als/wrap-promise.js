export function wrapPromise () {
  let id = 0;

  const OldPromise = Promise;

  // eslint-disable-next-line no-native-reassign,no-global-assign
  Promise = function (executor) {
    const _id = ++id;

    console.time(`Promise.constructor:${_id}`);

    const promise = new OldPromise(executor);

    // Modify promise here, if needed.

    console.timeEnd(`Promise.constructor:${_id}`);

    // @todo On active async event, compare the time spent in the promise constructor.

    return promise;
  };

  Promise.prototype = OldPromise.prototype;
  Object.setPrototypeOf(Promise, OldPromise);
}
