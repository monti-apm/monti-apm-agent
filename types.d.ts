type MontiEvent = {}

interface Kadira {
    connect: (endpoint: string, appId: string, appSecret: string) => void;

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
