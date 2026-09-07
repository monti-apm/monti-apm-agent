declare const MontiEventBrand: unique symbol

export interface MontiEvent {
    readonly [MontiEventBrand]: true
}

export type EventType =
    | 'start'
    | 'wait'
    | 'async'
    | 'db'
    | 'http'
    | 'email'
    | 'fs'
    | 'compute'
    | 'custom'
    | 'error'
    | 'complete'

export type FilterEventType = EventType | `${EventType}end`

export type TraceInfo = {
    type: 'method' | 'sub' | 'http' | 'job'
    name: string
}

export type ConnectOptions = {
    enableErrorTracking?: boolean
    disableClientErrorTracking?: boolean
    endpoint?: string
    hostname?: string
    uploadSourceMaps?: boolean
    recordIPAddress?: 'full' | 'anonymized' | 'none'
    eventStackTrace?: boolean
    disableNtp?: boolean
    /** In milliseconds. Set to 0 to disable */
    stalledTimeout?: number
    proxy?: string
    documentSizeCacheSize?: number
}

export type TrackErrorOptions = {
    type?: 'method' | 'client' | 'sub' | 'job' | 'server-crash' | 'server-internal'
    subType?: string
}

export interface TraceJobOptions {
    name: string;
    data?: object
    /** In milliseconds */
    waitTime?: number
}

export namespace Tracer {
    function addFilter(filterFunction: (eventType: FilterEventType, data: Record<string, any>, info: TraceInfo) => Record<string, any>): void
    function redactField(field: string): void
}

export namespace Monti {
    function trackError(error: Error | string, options?: TrackErrorOptions): void;
    function enableErrorTracking(): void;
    function disableErrorTracking(): void;

    // Everything below is server only

    var tracer: typeof Tracer

    function connect(appId: string, appSecret: string, options?: ConnectOptions): void;

    function startContinuousProfiling(): void;

    function enableClientErrorTracking(): void;
    function disableClientErrorTracking(): void;

    function ignoreErrorTracking(error: Error): void;

    function event<T>(name: string, fn: () => T): T;
    function event<T>(name: string, data: Record<string, any> | undefined, fn: () => T): T;

    /** Prefer Monti.event instead */
    function startEvent(name: string, data?: Record<string, any>): MontiEvent | false;
    function endEvent(event: MontiEvent | false, data?: Record<string, any>): void;

    function traceJob<T extends (...args: any) => any>(options: TraceJobOptions, fn: T): ReturnType<T>
    function recordNewJob (jobName: string): void;
    function recordPendingJobs (jobName: string, count: number): void;
}

declare var MontiNamespace: typeof Monti

declare global {
    var Monti: typeof MontiNamespace
    var Kadira: typeof MontiNamespace
}
