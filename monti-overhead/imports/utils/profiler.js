import fs from 'fs';
import v8Profiler from 'v8-profiler-next';
import path from 'path';

v8Profiler.setGenerateType(1);

export const writeToDisk = Meteor.wrapAsync(fs.writeFile);

export const stopCpuProfile = Meteor.wrapAsync(function (name, callback) {
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

    const filename = path.resolve(Meteor.absolutePath, `./${name}-${Date.now()}.cpuprofile`);
    console.log(`Writing profile to ${filename}`);
    writeToDisk(filename, profile);

    return {
      filename,
    };
  },
  registerMethods () {
    Meteor.methods({
      'profiler.start' (name) {
        Profiler.start(name);
      },
      'profiler.stop' (name) {
        return Profiler.stop(name);
      }
    });
  }
};
