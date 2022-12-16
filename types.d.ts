type MontiEvent = any

type ConnectOptions = {
    enableErrorTracking?: boolean
    endpoint?: string
    hostname?: string
    uploadSourceMaps?: boolean
    recordIPAddress?: boolean
    eventStackTrace?: boolean
    disableNtp?: boolean
    stalledTimeout?: number
}

type TraceInfo = {
    type?: string
    name?: string
}

export namespace Tracer {
    function addFilter(filterFunction: (eventType: string, data: any, info: TraceInfo) => any): void
}

export namespace Monti {
    var tracer: typeof Tracer

    function connect(appId: string, appSecret: string, options?: ConnectOptions): void;

    function startContinuousProfiling(): void;
    function enableErrorTracking(): void;
    function disableErrorTracking(): void;

    function trackError(error: Error, options?: any): void;

    function ignoreErrorTracking(error: Error): void;

    function startEvent(name: string, data?: any): MontiEvent | false;
    function endEvent(event: MontiEvent, data?: any): void;
}

declare var MontiNamespace: typeof Monti

declare global {
    var Monti: typeof MontiNamespace
    var Kadira: typeof MontiNamespace
}

