import React from 'react';
import { useReactive } from 'ahooks';
import { Tests } from './tests';
import { runWithProfiler } from './utils';

export const PerformanceMethods = ({ historyState }) => {
  const [history, setHistory] = historyState;

  const state = useReactive({
    isRunning: false,
    total: 1000,
    curProgress: null,
    averageCallDuration: null,
    profilerEnabled: false,
  });

  const runTest = async (test) => {
    const payload = {
      id: crypto.randomUUID(),
      testName: test,
      profilerEnabled: state.profilerEnabled,
      createdAt: new Date().toISOString(),
      montiApmInstalled: !!Package['montiapm:agent'],
    };

    if (state.profilerEnabled) {
      const { filename } = await runWithProfiler('monti-overhead', async () => {
        await Tests[test](state, payload);
      });

      payload.profilerFilename = filename;
    } else {
      await Tests[test](state, payload);
    }

    setHistory([...history, payload]);
  };

  return (
    <article className='mt-0 mb-0 overflow-y-auto max-h-[80vh]'>
      <header>Performance Tests</header>

      <label>
        Total Calls
        <input
          type='number' min={ 100 } max={ 100000 } onChange={ (e) => {
            state.total = Number(e.target.value);
          } } value={ state.total }
        />
      </label>

      <label>
        <input
          type='checkbox' checked={ state.profilerEnabled } onChange={ e => {
            state.profilerEnabled = e.target.checked;
          } }
        />
        Enable Profiler
      </label>

      <hr />

      <button onClick={ async () => runTest('echo') } disabled={ state.isRunning }>Echo</button>

      {state.memBefore ? <p>Heap Usage Before: {state.memBefore.heapUsed.toFixed(2)}kb</p> : null}
      {state.memAfter ? <p>Heap Usage After: {state.memAfter.heapUsed.toFixed(2)}kb</p> : null}
      {state.averageCallDuration ? <p>Average Call Duration: {state.averageCallDuration.toFixed(2)}ms</p> : null}

      <progress value={ state.curProgress } max={ state.total } />
    </article>
  );
};
