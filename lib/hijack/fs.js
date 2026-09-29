import fs from 'fs';
import { EventType } from '../constants';

function wrapCallback (args, createWrapper) {
  if (typeof args[args.length - 1] === 'function') {
    args[args.length - 1] = createWrapper(args[args.length - 1]);
  }
}

export function handleErrorEvent (eventEmitter, trace, event) {
  function handler (error) {
    if (trace && event) {
      Kadira.tracer.eventEnd(trace, event, {
        error
      });
    }

    // Node throws the error if there are no listeners
    // We want it to behave as if we are not listening to it
    if (eventEmitter.listenerCount('error') === 1) {
      eventEmitter.removeListener('error', handler);
      eventEmitter.emit('error', error);
    }
  }

  eventEmitter.on('error', handler);
}

export function wrapFs () {
  let originalStat = fs.stat;
  fs.stat = function () {
    const kadiraInfo = Kadira._getInfo();

    if (kadiraInfo) {
      let event = Kadira.tracer.event(kadiraInfo.trace, EventType.FS, {
        func: 'stat',
        path: arguments[0],
        options: typeof arguments[1] === 'object' ? arguments[1] : undefined
      });

      wrapCallback(arguments, (cb) => function () {
        Kadira.tracer.eventEnd(kadiraInfo.trace, event);

        cb(...arguments);
      });
    }

    return originalStat.apply(fs, arguments);
  };

  let originalCreateReadStream = fs.createReadStream;
  fs.createReadStream = function () {
    const kadiraInfo = Kadira._getInfo();
    let stream = originalCreateReadStream.apply(this, arguments);

    if (kadiraInfo) {
      const event = Kadira.tracer.event(kadiraInfo.trace, EventType.FS, {
        func: 'createReadStream',
        path: arguments[0],
        options: JSON.stringify(arguments[1])
      });

      stream.on('end', () => {
        Kadira.tracer.eventEnd(kadiraInfo.trace, event);
      });

      handleErrorEvent(stream, kadiraInfo.trace, event);
    }

    return stream;
  };
}
