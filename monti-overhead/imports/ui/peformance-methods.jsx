import React from 'react';
import { useReactive } from 'ahooks';
import { Tests } from './tests';
import { runWithProfiler } from './utils';
import { TrashIcon } from '@heroicons/react/20/solid';

export const PerformanceMethods = ({ historyState, historyListRef }) => {
  const [history, setHistory] = historyState;

  const state = useReactive({
    isRunning: false,
    total: 1000,
    curProgress: null,
    averageCallDuration: null,
    profilerEnabled: true,
  });

  const runTest = async (test) => {
    state.isRunning = true;

    const payload = {
      id: crypto.randomUUID(),
      num: history.length + 1,
      testName: test,
      profilerEnabled: state.profilerEnabled,
      createdAt: new Date().toISOString(),
      montiApmInstalled: !!Package['montiapm:agent'],
    };

    if (state.profilerEnabled) {
      const { filename, diff } = await runWithProfiler('monti-overhead', async () => {
        await Tests[test](state, payload);
      });

      payload.profilerFilename = filename;
      payload.diff = diff;
    } else {
      await Tests[test](state, payload);
    }

    setHistory([...history, payload]);

    state.isRunning = false;

    historyListRef?.current?.scrollTo({
      top: 0,
    });
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

      <div>
        <button onClick={ () => setHistory([]) } className='inline-flex w-auto outline secondary text-xs px-3 py-2' disabled={ !history.length }>
          <TrashIcon className='w-3 h-3 self-center mr-1' /> Clear History
        </button>
      </div>
    </article>
  );
};
