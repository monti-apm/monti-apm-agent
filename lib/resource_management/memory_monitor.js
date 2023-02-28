import { EventEmitter } from 'events';

export class MemoryMonitor extends EventEmitter {
  static MAX_PAYLOAD_SIZE = 1024 * 1024 * 20;
  static CRITICAL_MEMORY_THRESHOLD = MemoryMonitor.MAX_PAYLOAD_SIZE * 9;
  static HIGH_MEMORY_THRESHOLD = MemoryMonitor.MAX_PAYLOAD_SIZE * 27;

  constructor (interval = 1000) {
    super();

    this.interval = setInterval(() => {
      const stats = process.memoryUsage();

      this.emit('tick', stats);

      const { heapUsed, heapTotal } = stats;

      if (heapTotal - heapUsed < MemoryMonitor.CRITICAL_MEMORY_THRESHOLD) {
        this.emit('memory:critical', stats);
      } else if (heapTotal - heapUsed < MemoryMonitor.HIGH_MEMORY_THRESHOLD) {
        this.emit('memory:high', stats);
      }
    }, interval);
  }

  onMemoryCritical (callback) {
    this.on('memory:critical', callback);
  }

  onMemoryHigh (callback) {
    this.on('memory:high', callback);
  }

  destroy () {
    clearInterval(this.interval);
    this.removeAllListeners();
  }
}

