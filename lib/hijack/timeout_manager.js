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
      Kadira.EventBus.__emitter.emit('timeout', kadiraInfo, error);

      Monti.trackError(error, { type, subType: 'server', kadiraInfo });

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
