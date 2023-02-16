export function intercept (func) {
  return function (params) {
    const result = func.call(this, params);

    return Object.assign({}, params, result ?? {});
  };
}

export function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
