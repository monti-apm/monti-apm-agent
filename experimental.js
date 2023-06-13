const asyncHooks = require('async_hooks');

const ignoredStackFrames = [/internal\/async_hooks/, /^\s+at AsyncHook\.init/];

function stackTrace () {
  const restoreLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = 10;

  const obj = {};
  Error.captureStackTrace(obj, stackTrace);
  const structuredStackTrace = obj.stack;

  Error.stackTraceLimit = restoreLimit;

  return deleteLinesWhichMatchAnyOf(structuredStackTrace, ignoredStackFrames);
}

function deleteLinesWhichMatchAnyOf (string, regexes) {
  return string.split('\n').filter(line => !regexes.some(regex => regex.test(line))).join('\n');
}

const resources = new Map();

const hook = asyncHooks.createHook({
  init: (asyncId, type, triggerAsyncId) => {
    if (type !== 'PROMISE') return;

    if (triggerAsyncId) {
      const parent = resources.get(triggerAsyncId);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(asyncId);
      }
    }

    resources.set(asyncId, {
      asyncId,
      triggerAsyncId,
      type,
      trace: stackTrace(),
    });
  },
  before: (asyncId) => {
    if (!resources.has(asyncId)) return;
    resources.get(asyncId).before = Date.now();
  },
  after: (asyncId) => {
    if (!resources.has(asyncId)) return;
    resources.get(asyncId).after = Date.now();
  },
  promiseResolve: (asyncId) => {
    if (!resources.has(asyncId)) return;
    resources.get(asyncId).promiseResolve = Date.now();
  },
  destroy: (asyncId) => {
    if (!resources.has(asyncId)) return;
    resources.get(asyncId).destroy = Date.now();
  }
});

hook.enable();

process.once('beforeExit', function () {
  hook.disable();
});

async function foo () {
  await 0;
  return true;
}

async function start () {
  await new Promise((resolve) => setTimeout(resolve, 1000)).then(() => true);

  await foo();
}

start().catch(console.error).finally(() => {
  console.log(resources);
});
