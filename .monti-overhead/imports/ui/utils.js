import { call } from '../utils/methods';

export async function runWithProfiler (name, func) {
  const result = await call('profiler.start', name);
  await func();
  return Object.assign({}, result, await call('profiler.stop', name));
}
