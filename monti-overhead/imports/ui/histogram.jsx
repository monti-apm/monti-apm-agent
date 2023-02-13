import React from 'react';

export function Histogram ({ appState }) {
  return (
    <div>
      {appState.history.map(({ id, memBefore, memAfter, startTime, endTime }) =>
        (<div key={ id } className='p-2'>
          <div>Duration: {((endTime - startTime) / 1000).toFixed(2)} ms</div>
          <div>Memory Offset: {(memAfter.heapUsed - memBefore.heapUsed).toFixed(2)} kb</div>
        </div>)
      )}
    </div>
  );
}
