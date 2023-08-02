export function intercept (func) {
  return function (params) {
    const result = func.call(this, params);

    return Object.assign({}, params, result ?? {});
  };
}

export function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function readableToJson (readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data', (chunk) => {
      chunks.push(chunk);
    });
    readable.on('end', () => {
      resolve(Buffer.concat(chunks).toString());
    });
    readable.on('error', (error) => {
      reject(error);
    });
  });
}
