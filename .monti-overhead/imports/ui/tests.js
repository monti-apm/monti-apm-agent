import { call } from '../utils/methods';
import { range } from 'lodash';
import { subscribe } from '../utils/subs';

export const callbackTester = (callback) => async (state, payload) => {
  payload.totalCalls = state.total;
  payload.memBefore = await call('getMemoryUsage');
  payload.startTime = performance.now();

  for (const i of range(state.total)) {
    await callback();
    state.curProgress = i + 1;
    state.averageCallDuration = (performance.now() - payload.startTime) / (i + 1);
  }

  payload.endTime = performance.now();

  state.curProgress = null;

  payload.memAfter = await call('getMemoryUsage');
}

export const getMethodTester = (methodName, methodParams) => callbackTester(async () => {
  await call(methodName, methodParams);
})

export const Tests = {
  echo: getMethodTester('echo', 'Hello World!'),
  find: getMethodTester('find'),
  largeTrace: getMethodTester('trace:spam:100'),
  subscribe: callbackTester(async () => {
    const sub = await subscribe('links');
    sub.stop();
  }),
  manualEvent: {
    test: getMethodTester('manualEvent'),
    requiresMontiApm: true
  }
};
