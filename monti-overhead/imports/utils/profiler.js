import fs from 'fs';
import v8Profiler from 'v8-profiler-next';

export const writeToDisk = Kadira._wrapAsync(fs.writeFile);

export const stopCpuProfile = Kadira._wrapAsync(function (name, timeToProfileSecs, callback) {
  const profile = v8Profiler.stopProfiling(name);
  profile.export((err, result) => {
    if (err) {
      callback(err);
    }

    profile.delete();
    callback(null, result);
  });
});

export const Profiler = {
  start (name) {
    v8Profiler.startProfiling(name);
  },
  stop (name) {
    const profile = stopCpuProfile(name);

    writeToDisk(`./${name}-${Date.now()}.cpuprofile`, profile);
  },
  registerMethods () {
    Meteor.methods({
      'profiler.start' (name) {
        Profiler.start(name);
      },
      'profiler.stop' (name) {
        Profiler.stop(name);
      }
    });
  }
};
