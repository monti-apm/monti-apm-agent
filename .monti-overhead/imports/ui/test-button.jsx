import React from 'react';
import { Tests } from './tests';

export function TestButton({ test, onTestRun, state }) {
  if (typeof Tests[test] === 'object' && Tests[test].requiresMontiApm) {
    return <button onClick={async () => await onTestRun(test)} disabled={!Package['montiapm:agent'] || state.isRunning}>{test}</button>
  }

  return <button onClick={async () => await onTestRun(test)} disabled={state.isRunning}>{test}</button>
}
