import React, { useRef } from 'react';
import { PerformanceMethods } from './peformance-methods';
import { useLocalStorageState } from 'ahooks';
import { Histogram } from './histogram';

const isMontiApmInstalled = !!Package['montiapm:agent'];

export const App = () => {
  const historyListRef = useRef(null);
  const historyState = useLocalStorageState('monti-overhead-history', { defaultValue: [] });

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
        <PerformanceMethods historyState={ historyState } historyListRef={ historyListRef } />
        <Histogram historyState={ historyState } historyListRef={ historyListRef } />
      </div>
    </div>
  );
};
