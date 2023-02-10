import React, { useCallback, useState } from 'react';
import { range } from 'lodash';
import { call } from '../utils/methods';

export const PerformanceMethods = () => {
  const [isRunning, setRunning] = useState(false)
  const [total, setTotal] = useState(1000)
  const [curProgress, setCurProgress] = useState(null)

  const callEcho = useCallback(async () => {
    setRunning(true)
    console.time('echo')
    for (const i of range(total)) {
      await call('echo', 'Hello World!')
      setCurProgress(i + 1)
    }
    console.timeEnd('echo')
    setRunning(false)
    setCurProgress(null)
  }, [total, isRunning])

  return (
    <div>
      <h2>Performance Tests</h2>

      <label>
        Total Calls
        <input type='number' min={100} max={100000} onChange={(e) => setTotal(Number(e.target.value))} value={total} />
      </label>

      <h3>Tests</h3>
      <button onClick={callEcho} disabled={isRunning}>Echo</button>

      <progress value={curProgress} max={total}></progress>
    </div>
  );
};
