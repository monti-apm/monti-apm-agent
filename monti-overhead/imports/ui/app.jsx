import React from 'react';
import { PerformanceMethods } from './peformance-methods';

const isMontiApmInstalled = !!Package['montiapm:agent'];

export const App = () => (
  <div>
    <nav>
      <ul>
        <li><strong>Monti Overhead</strong></li>
      </ul>
      <ul>
        <li>{isMontiApmInstalled ? 'Monti APM Installed' : 'Monti APM Not Installed'}</li>
      </ul>
    </nav>
    <PerformanceMethods/>
  </div>
);
