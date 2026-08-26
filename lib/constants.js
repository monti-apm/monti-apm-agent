export const MaxAsyncLevel = 2;

export const DEBUG_ASYNC_HOOKS = false;

export const EventType = {
  Async: 'async',
  Complete: 'complete',
  Compute: 'compute',
  Custom: 'custom',
  DB: 'db',
  Error: 'error',
  FS: 'fs',
  HTTP: 'http',
  Start: 'start',
  Wait: 'wait',
  Email: 'email',
};

export const JobType = {
  CPU_PROFILE: 'cpuProfile',
  HEAP_SNAPSHOT: 'heapSnapshot',
  ALLOCATION_PROFILE: 'allocationProfile'
};
