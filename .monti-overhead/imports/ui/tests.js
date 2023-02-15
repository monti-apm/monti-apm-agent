import { call } from '../utils/methods';
import { range } from 'lodash';

export const getTester = (methodName, methodParams) => async (state, payload) => {
  payload.totalCalls = state.total;
  payload.memBefore = await call('getMemoryUsage');
  payload.startTime = performance.now();

  for (const i of range(state.total)) {
    await call(methodName, methodParams);
    state.curProgress = i + 1;
    state.averageCallDuration = (performance.now() - payload.startTime) / (i + 1);
  }

  payload.endTime = performance.now();

  state.curProgress = null;

  payload.memAfter = await call('getMemoryUsage');
}

export const Tests = {
  echo: getTester('echo', 'Hello World!'),
  find: getTester('find'),
};
