import { runTestAsync } from './_helpers/helpers';
import { MemoryMonitor } from '../lib/resource_management/memory_monitor';

const getMockMemoryUsage = ({ heapTotal, heapUsed }) => ({
  rss: 100000000,
  heapUsed,
  heapTotal,
  external: 100000000,
  arrayBuffers: 100000000,
});

Tinytest.add(
  'Resource Management - Memory Monitor',
  runTestAsync(async function (test) {
    const heapTotal = 100000000;

    const muref = getMockMemoryUsage({ heapTotal, heapUsed: heapTotal - MemoryMonitor.CRITICAL_MEMORY_THRESHOLD + 1 });

    const original = process.memoryUsage;

    process.memoryUsage = () => muref;

    const monitor = new MemoryMonitor(100);

    const critical = await new Promise(resolve => monitor.onMemoryCritical(resolve));

    test.equal(critical.heapUsed, heapTotal - MemoryMonitor.CRITICAL_MEMORY_THRESHOLD + 1);

    muref.heapUsed = heapTotal - MemoryMonitor.HIGH_MEMORY_THRESHOLD + 1;

    const high = await new Promise(resolve => monitor.onMemoryHigh(resolve));

    test.equal(high.heapUsed, heapTotal - MemoryMonitor.HIGH_MEMORY_THRESHOLD + 1);

    muref.heapUsed = 30000000;

    const tick = await new Promise(resolve => monitor.on('tick', resolve));

    test.equal(tick.heapUsed, 30000000);

    process.memoryUsage = original;
    monitor.destroy();
  })
);
