export function wrapSyncedCron () {
  Meteor.startup(() => {
    let cronPackage = Package['quave:synced-cron'] || Package['percolate:synced-cron'];

    if (!cronPackage) {
      return;
    }

    let cron = cronPackage.SyncedCron;

    Object.values(cron._entries).forEach(entry => {
      let oldJob = entry.job;

      entry.job = function (...args) {
        return Kadira.traceJob({ name: entry.name },() => oldJob.apply(this, args));
      };
    });
  });
}
