import React from 'react';
import { useReactive } from 'ahooks';
import { Tests } from './tests';

export const PerformanceMethods = ({ appState }) => {
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

  return (
    <article>
      <header>Performance Tests</header>

      <label>
        Total Calls
        <input type='number' min={100} max={100000} onChange={(e) => state.total = Number(e.target.value)} value={state.total} />
      </label>

      <h3>Tests</h3>

      <button onClick={() => Tests.echo(state, appState)} disabled={state.isRunning}>Echo</button>

      {state.memBefore ? <p>Heap Usage Before: {state.memBefore.heapUsed.toFixed(2)}kb</p> : null}
      {state.memAfter ? <p>Heap Usage After: {state.memAfter.heapUsed.toFixed(2)}kb</p> : null}
      {state.averageCallDuration ? <p>Average Call Duration: {state.averageCallDuration.toFixed(2)}ms</p> : null}

      <progress value={state.curProgress} max={state.total}></progress>
    </article>
  );
};
