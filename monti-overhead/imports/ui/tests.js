import { call } from '../utils/methods';
import { range } from 'lodash';

export const Tests = {
  echo: async (state, payload) => {
    state.isRunning = true;

    payload.totalCalls = state.total;
    payload.memBefore = await call('getMemoryUsage');
    payload.startTime = performance.now();

    for (const i of range(state.total)) {
      await call('echo', 'Hello World!');
      state.curProgress = i + 1;
      state.averageCallDuration = (performance.now() - payload.startTime) / (i + 1);
    }

    payload.endTime = performance.now();

    state.isRunning = false;
    state.curProgress = null;

    payload.memAfter = await call('getMemoryUsage');
  }
};
