import React from 'react';
import { PerformanceMethods } from './peformance-methods';
import { useReactive } from 'ahooks';
import { Histogram } from './histogram';

const isMontiApmInstalled = !!Package['montiapm:agent'];

export const App = () => {
  const appState = useReactive({
    history: [],
  })

  const montiInstalled = isMontiApmInstalled ?
    <span className='font-medium text-green-600'>Monti APM Installed</span> :
    <span className='font-medium text-red-500'>Monti APM Not Installed</span>;

  return (
    <div className='p-4'>
      <nav>
        <ul>
          <li><strong>Monti Overhead</strong></li>
        </ul>
        <ul>
          <li>{montiInstalled}</li>
        </ul>
      </nav>
      <div className='grid grid-cols-2'>
        <PerformanceMethods appState={appState} />
        <Histogram appState={appState} />
      </div>
    </div>
  );
};
