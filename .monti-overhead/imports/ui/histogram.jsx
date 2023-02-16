import React from 'react';
import classnames from 'classnames';

export function Histogram ({ historyState, historyListRef }) {
  const [history] = historyState;

  return (
    <div className='flex flex-col-reverse gap-4 overflow-y-scroll max-h-full' ref={ historyListRef }>
      {Array.from(history).reverse().map((data) => {
        const {
          id,
          num,
          memBefore,
          memAfter,
          startTime,
          endTime,
          totalCalls,
          testName,
          profilerFilename,
          profilerEnabled,
          createdAt,
          montiApmInstalled,
          diff,
          heapBeforePath,
          heapAfterPath,
        } = data;

        return (<table key={ id } className={classnames('p-2 font-medium rounded text-xs', {
          'bg-green-500/20': montiApmInstalled,
          'bg-red-500/20': !montiApmInstalled,
        })} role='grid'>
          <thead>
            <tr>
              <th colSpan='2'>Test #{num} {createdAt}</th>
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
              <td>{totalCalls}x</td>
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
              <td>CPU & Heap Snapshot Filenames:</td>
              <td>
                <div>{profilerFilename || 'N/A'}</div>
                <div>{heapBeforePath || 'N/A'}</div>
                <div>{heapAfterPath || 'N/A'}</div>
              </td>
            </tr>
            <tr>
              <td>Profiler Diff:</td>
              <td>
                {diff ?
                  <details>
                    <summary>See JSON</summary>
                    <pre>{JSON.stringify(diff, null, 2)}</pre>
                  </details> : 'N/A'}
              </td>
            </tr>
          </tbody>
        </table>);
      }
      )}
    </div>
  );
}
