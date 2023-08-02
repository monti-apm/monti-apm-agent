export function handleCpuProfileJob (job) {
  const ProfilerPackage = Package['montiapm:profiler'];

  if (!ProfilerPackage) {
    console.log('Monti APM Profiler package is not installed');
    return;
  }

  const { _id, data } = job;

  const { duration = 10 } = data || {};

  if (!_id) {
    console.log('Monti APM: Job ID is missing');
    return;
  }

  Meteor.call('monti.profileCpu', duration, _id, 'remote');
}
