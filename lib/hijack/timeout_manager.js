const { EventEmitter } = require('events');

export const TimeoutManager = {
  id: 0,
  map: new Map(),
  bus: new EventEmitter(),

  prettyMessage: {
    method: 'Method Timeout',
    sub: 'Subscription Timeout'
  },

  addTimeout (fn, timeout) {
    if (!fn) {
      throw new Error('TimeoutManager.addTimeout: fn is required');
    }

    const id = ++this.id;

    this.map.set(id, setTimeout(() => {
      fn();

      this.map.delete(id);
    }, timeout));

    return id;
  },

  addMethodTimeout ({ kadiraInfo, type, method, timeout = Kadira.options.trackingTimeout }) {
    if (!timeout) {
      return;
    }

    const error = new Error(`${this.prettyMessage[type] || 'Unknown Timeout'} (${timeout}ms): ${method}`);

    kadiraInfo.timeoutId = this.addTimeout(() => {
      this.bus.emit('timeout', kadiraInfo, error);

      const { message, stack } = error;

      Kadira.models.error.trackError(error, {
        type,
        subType: 'server',
        name: message,
        errored: true,
        at: Kadira.syncedDate.getTime(),
        events: [['start', 0, {}], ['error', 0, { error: { message, stack } }]],
        metrics: { total: 0 }
      });

      console.error(`[Monti APM] ${error.message}`);
    }, timeout);
  },

  clearTimeout ({ kadiraInfo = Kadira._getInfo() } = {}) {
    if (!kadiraInfo) return;

    const { timeoutId } = kadiraInfo;

    if (timeoutId && this.map.has(timeoutId)) {
      clearTimeout(this.map.get(timeoutId));
      this.map.delete(timeoutId);
      delete kadiraInfo.timeoutId;
    }
  }
};
