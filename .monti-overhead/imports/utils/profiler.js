import fs from 'fs';
import v8Profiler from 'v8-profiler-next';
import path from 'path';
import memwatch from '@airbnb/node-memwatch';


let hd;


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
    global.gc();
    hd = new memwatch.HeapDiff();
    v8Profiler.startProfiling(name);
  },
  stop (name) {
    const profile = stopCpuProfile(name);
    global.gc();
    const diff = hd.end();

    const filename = path.resolve(Meteor.absolutePath, `./${name}-${Date.now()}.cpuprofile`);
    console.log(`Writing profile to ${filename}`);
    writeToDisk(filename, profile);

    return {
      filename,
      diff
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
