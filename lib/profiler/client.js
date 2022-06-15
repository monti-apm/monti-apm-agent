/* global Kadira */

// For just making a notice
// `montiapm:profiler` will override this method to add
// actual functionality
Kadira.profileCpu = function profileCpu () {
  const message =
    'Please install montiapm:profiler' +
    ' to take a CPU profile.';
  console.log(message);
};
