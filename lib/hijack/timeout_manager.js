export const TimeoutManager = {
  id: 0,
  map: new Map(),

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

  clearTimeout ({ kadiraInfo }) {
    if (kadiraInfo.timeoutId && this.map.has(kadiraInfo.timeoutId)) {
      clearTimeout(this.map.get(kadiraInfo.timeoutId));
      this.map.delete(kadiraInfo.timeoutId);
      delete kadiraInfo.timeoutId;
    }
  }
};
