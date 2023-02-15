import React from 'react';

export function TestButton({ test, onTestRun, state }) {
  return <button onClick={ async () => await onTestRun(test) } disabled={ state.isRunning }>{test}</button>
}
