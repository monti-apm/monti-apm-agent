export type MontiEvent = any
export type KadiraInfo = any

export type ConnectOptions = {
    enableErrorTracking?: boolean
    endpoint?: string
    hostname?: string
    uploadSourceMaps?: boolean
    recordIPAddress?: 'full' | 'anonymized' | 'none'
    eventStackTrace?: boolean
    disableNtp?: boolean
    stalledTimeout?: number
}

export type TrackErrorOptions = {
    type?: 'method' | 'client' | 'sub' | 'server-crash' | 'server-internal'
    subType?: string
    kadiraInfo?: KadiraInfo
}

export type TraceInfo = {
    type: 'sub' | 'method' | 'http'
    name: string
}

export type EventType = 'start' | 'end' | 'email' | 'db' | 'http' | 'fs' | 'compute' | 'custom'

export namespace Tracer {
    function addFilter(filterFunction: (eventType: EventType, data: Record<string, any>, info: TraceInfo) => any): void
}

export interface TraceJobOptions {
    name: string;
    data?: object
    waitTime?: number
}

export namespace Monti {
    var tracer: typeof Tracer

    function connect(appId: string, appSecret: string, options?: ConnectOptions): void;

    function startContinuousProfiling(): void;
    function enableErrorTracking(): void;
    function disableErrorTracking(): void;

    function trackError(error: Error, options?: TrackErrorOptions): void;

    function ignoreErrorTracking(error: Error): void;

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
