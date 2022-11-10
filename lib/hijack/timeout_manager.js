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

    this.map.set(id, setTimeout(Meteor.bindEnvironment(() => {
      fn();

      this.map.delete(id);
    }), timeout));

    return id;
  },

  trackTimeout ({ kadiraInfo, msg, timeout = Kadira.options.trackingTimeout }) {
    if (!timeout) {
      return;
    }

    const type = msg.msg;
    const method = msg.method || msg.name;

    const error = new Error(`${this.prettyMessage[type] || 'Unknown Timeout'} (${timeout}ms): ${method}`);

    kadiraInfo.timeoutId = this.addTimeout(() => {
      Kadira.EventBus.emit('timeout', kadiraInfo, error);

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
