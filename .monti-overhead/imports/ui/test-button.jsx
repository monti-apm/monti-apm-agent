import React from 'react';
import { Tests } from './tests';

export function TestButton({ test, onTestRun, ephemeralState }) {
  if (typeof Tests[test] === 'object' && Tests[test].requiresMontiApm) {
    return <button onClick={async () => await onTestRun(test)} disabled={!Package['montiapm:agent'] || ephemeralState.isRunning}>{test}</button>
  }

  return <button onClick={async () => await onTestRun(test)} disabled={ephemeralState.isRunning}>{test}</button>
}
