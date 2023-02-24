import { LinksCollection } from '../api/links';
import { LargeTraceRange } from '../utils/constants';

Meteor.publish('links', function () {
  return LinksCollection.find({});
})

Meteor.methods({
  echo (msg) {
    return msg;
  },

  find () {
    return LinksCollection.find({}).fetch()
  },

  manualEvent () {
    if (!Package['montiapm:agent']) throw new Error('Monti APM is not installed');

    const event = Monti.startEvent('manualEvent', { details: true });

    LinksCollection.find({}).fetch();

    LinksCollection.update({}, { $set: { updatedAt: new Date() } });

    Monti.trackError(new Error('Something went wrong'));

    Monti.endEvent(event);

    return true;
  },

  getMemoryUsage () {
    global.gc();

    const memory = process.memoryUsage();

    return {
      rss: memory.rss / 1024,
      heapTotal: memory.heapTotal / 1024,
      heapUsed: memory.heapUsed / 1024,
      external: memory.external / 1024,
    };
  }
});

for (const i of LargeTraceRange) {
  Meteor.methods({
    [`trace:spam:${i}`] ({ bigstring }) {
      if (!bigstring.length) console.log('bigstring is empty');

      LinksCollection.find({}).count();

      Monti.trackError(new Error('Something went wrong'));
    }
  })
}
