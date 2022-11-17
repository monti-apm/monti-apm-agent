import { millisToHuman } from '../common/utils';

export const TimeoutManager = {
  id: 0,
  map: new Map(),

  prettyMessage: {
    method: (method) => `Method "${method}" still running after`,
    sub: (sub) => `Subscription "${sub}" still running after`
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

  trackTimeout ({ kadiraInfo, msg, timeout = Kadira.options.stalledTimeout }) {
    if (!timeout) {
      return;
    }

    const type = msg.msg;
    const method = msg.method || msg.name;

    const error = new Error(`${this.prettyMessage[type](method) || 'Unknown Timeout'} ${millisToHuman(timeout)}`);

    kadiraInfo.timeoutId = this.addTimeout(() => {
      Kadira.EventBus.emit('method', 'timeout', kadiraInfo, error);

      Monti.trackError(error, { type, subType: 'server', kadiraInfo });

      console.warn(`[Monti APM] ${error.message}`);
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
