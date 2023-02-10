import React from 'react';
import { PerformanceMethods } from './peformance-methods';

const isMontiApmInstalled = !!Package['montiapm:agent'];

export const App = () => {
  const montiInstalled = isMontiApmInstalled ?
    <span className='font-medium text-green-600'>Monti APM Installed</span> :
    <span className='font-medium text-red-500'>Monti APM Not Installed</span>;

  return (
    <div>
      <nav>
        <ul>
          <li><strong>Monti Overhead</strong></li>
        </ul>
        <ul>
          <li>{montiInstalled}</li>
        </ul>
      </nav>
      <PerformanceMethods/>
    </div>
  );
};
