import fs from 'fs';
import v8Profiler from 'v8-profiler-next';
import path from 'path';
import memwatch from '@airbnb/node-memwatch';
import { orderBy } from 'lodash';
import v8 from 'v8';
import { readableToJson } from './func';


let hd;


v8Profiler.setGenerateType(1);

export const writeToDisk = Meteor.wrapAsync(fs.writeFile);

export const stopCpuProfile = Meteor.wrapAsync(function (name, callback) {
  const profile = v8Profiler.stopProfiling(name);

  if (!profile) {
    return
  }

  profile.export((err, result) => {
    if (err) {
      callback(err);
    }

    profile.delete();
    callback(null, result);
  });
});

export const takeHeapSnapshot = Meteor.wrapAsync(function (name, suffix, callback) {
  const snapshot = Promise.await(readableToJson(v8.getHeapSnapshot()));

  const filename = path.resolve(Meteor.absolutePath, `../${name}-${Date.now()}-${suffix}.heapsnapshot`);
  console.log(`Writing snapshot to ${filename}`);
  writeToDisk(filename, snapshot);

  callback(null, filename);
})

export const Profiler = {
  start (name) {
    global.gc();
    const heapBeforePath = takeHeapSnapshot(name, 'before')

    hd = new memwatch.HeapDiff();
    v8Profiler.startProfiling(name);

    return { heapBeforePath };
  },
  stop (name) {
    const profile = stopCpuProfile(name);
    global.gc();
    const heapAfterPath = takeHeapSnapshot(name, 'after')
    const diff = hd.end();

    const filename = path.resolve(Meteor.absolutePath, `../${name}-${Date.now()}.cpuprofile`);
    console.log(`Writing profile to ${filename}`);
    writeToDisk(filename, profile);

    diff.change.details = orderBy(diff.change.details, 'size_bytes', 'desc')

    return {
      filename,
      diff,
      heapAfterPath,
    };
  },
  registerMethods () {
    Meteor.methods({
      'profiler.start' (name) {
        return Profiler.start(name);
      },
      'profiler.stop' (name) {
        return Profiler.stop(name);
      }
    });
  }
};
