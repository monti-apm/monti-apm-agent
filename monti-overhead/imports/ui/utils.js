import { call } from '../utils/methods';

export async function runWithProfiler (name, func) {
  await call('profiler.start', name);
  await func();
  await call('profiler.stop', name);
}
