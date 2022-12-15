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

interface Tracer {
    addFilter(filterFunction: (eventType: string, data: any, info: TraceInfo) => any): void
}

interface Kadira {
    tracer: Tracer

    connect: (appId: string, appSecret: string, options?: ConnectOptions) => void;

    startContinuousProfiling: () => void;
    enableErrorTracking: () => void;
    disableErrorTracking: () => void;

    trackError: (error: Error, options: any) => void;

    ignoreErrorTracking: (error: Error) => void;

    startEvent: (name: string, data: any) => MontiEvent | false;
    endEvent: (event: MontiEvent, data: any) => void;
}

declare global {
    var Kadira: Kadira;
    var Monti: Kadira;

    interface Window {
        Kadira: Kadira;
        Monti: Kadira;
    }

    interface Global {
        Kadira: Kadira;
        Monti: Kadira;
    }
}


export {}
