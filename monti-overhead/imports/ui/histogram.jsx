import React from 'react';
import { TrashIcon } from '@heroicons/react/20/solid';

export function Histogram ({ historyState }) {
  const [history, setHistory] = historyState;

  return (
    <div className='space-y-4 overflow-y-scroll max-h-[80vh]'>
      <div>
        <button onClick={ () => setHistory([]) } className='inline-flex w-auto outline secondary text-xs px-3 py-2' disabled={ !history.length }>
          <TrashIcon className='w-3 h-3 self-center mr-1' /> Clear
        </button>
      </div>

      {history.map((data, index) => {
        const { id, memBefore, memAfter, startTime, endTime, totalCalls, testName, profilerFilename, profilerEnabled, createdAt, montiApmInstalled } = data;

        return (<table key={ id } className='p-2 font-medium rounded text-xs' role='grid'>
          <thead>
            <tr>
              <th colSpan='2'>Test #{index + 1} {createdAt}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Test Name:</td>
              <td>{testName}</td>
            </tr>
            <tr>
              <td>Total Duration:</td>
              <td>{((endTime - startTime)).toFixed(2)} ms</td>
            </tr>
            <tr>
              <td>Total Calls:</td>
              <td>{totalCalls} ms</td>
            </tr>
            <tr>
              <td>Monti APM Installed:</td>
              <td>{JSON.stringify(montiApmInstalled)}</td>
            </tr>
            <tr>
              <td>Average Duration:</td>
              <td>{((endTime - startTime) / totalCalls).toFixed(2)} ms</td>
            </tr>
            <tr>
              <td>Memory Before:</td>
              <td>{(memBefore.heapUsed).toFixed(2)} kb</td>
            </tr>
            <tr>
              <td>Memory After:</td>
              <td>{(memAfter.heapUsed).toFixed(2)} kb</td>
            </tr>
            <tr>
              <td>Memory Offset:</td>
              <td>{(memAfter.heapUsed - memBefore.heapUsed).toFixed(2)} kb</td>
            </tr>
            <tr>
              <td>Profiler Enabled:</td>
              <td>{JSON.stringify(profilerEnabled)}</td>
            </tr>
            <tr>
              <td>Profiler Filename:</td>
              <td>{profilerFilename || 'N/A'}</td>
            </tr>
          </tbody>

        </table>);
      }
      )}
    </div>
  );
}
