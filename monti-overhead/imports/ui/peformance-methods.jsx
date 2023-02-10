import React, { useCallback } from 'react';
import { range } from 'lodash';
import { call } from '../utils/methods';
import { useReactive } from 'ahooks';

export const PerformanceMethods = () => {
  const state = useReactive({
    isRunning: false,
    total: 1000,
    curProgress: null,
    memBefore: null,
    memAfter: null,
    startTime: null,
    endTime: null,
    averageCallDuration: null,
  })

  const callEcho = useCallback(async () => {
    state.memBefore = await call('getMemoryUsage')
    state.isRunning = true
    state.startTime = performance.now()

    for (const i of range(state.total)) {
      await call('echo', 'Hello World!')
      state.curProgress = i + 1
      state.averageCallDuration = (performance.now() - state.startTime) / (i + 1)
    }

    state.endTime = performance.now()

    state.isRunning = false
    state.curProgress = null

    state.memAfter = await call('getMemoryUsage')

    console.log('Memory Usage Before:', state.memBefore)
    console.log('Memory Usage After:', state.memAfter)
    console.log('Average Call Duration:', state.averageCallDuration, 'ms')
  }, [state.total, state.isRunning, state.memBefore, state.memAfter, state.curProgress])

  return (
    <article>
      <header>Performance Tests</header>

      <label>
        Total Calls
        <input type='number' min={100} max={100000} onChange={(e) => state.total = Number(e.target.value)} value={state.total} />
      </label>

      <h3>Tests</h3>
      <button onClick={callEcho} disabled={state.isRunning}>Echo</button>

      {state.memBefore ? <p>Heap Usage Before: {state.memBefore.heapUsed.toFixed(2)}kb</p> : null}
      {state.memAfter ? <p>Heap Usage After: {state.memAfter.heapUsed.toFixed(2)}kb</p> : null}
      {state.averageCallDuration ? <p>Average Call Duration: {state.averageCallDuration.toFixed(2)}ms</p> : null}

      <progress value={state.curProgress} max={state.total}></progress>
    </article>
  );
};
