import fs from 'fs';
const Fibers = require('fibers');

function wrapCallback(args, createWrapper) {
  if (typeof args[args.length - 1] === 'function') {
    args[args.length - 1] = createWrapper(args[args.length - 1])
  }
}

export function wrapFs() {
  // Some npm packages will do fs calls in the
  // callback of another fs call.
  // This variable is set with the kadiraInfo while
  // a callback is run so we can track other fs calls
  let fsKadiraInfo = null;
  
  let originalStat = fs.stat;
  fs.stat = function () {
    const kadiraInfo = Kadira._getInfo() || fsKadiraInfo;

    if (kadiraInfo) {
      let event = Kadira.tracer.event(kadiraInfo.trace, 'fs', {
        func: 'stat',
        path: arguments[0],
        options: typeof arguments[1] === 'object' ? arguments[1] : undefined
      });

      wrapCallback(arguments, (cb) => {
        return function () {
          Kadira.tracer.eventEnd(kadiraInfo.trace, event);

          if (!Fibers.current) {
            fsKadiraInfo = kadiraInfo;
          }

          try {
            cb.apply(null, arguments)
          } finally {
            fsKadiraInfo = null;
          }
        }
      })
    }

    return originalStat.apply(fs, arguments)
  }

  let originalCreateReadStream = fs.createReadStream;
  fs.createReadStream = function () {
    const kadiraInfo = Kadira._getInfo() || fsKadiraInfo;
    let stream = originalCreateReadStream.apply(this, arguments);

    if (kadiraInfo) {
      const event = Kadira.tracer.event(kadiraInfo.trace, 'fs', {
        func: 'createReadStream',
        path: arguments[0],
        options: JSON.stringify(arguments[1])
      });

      stream.on('end', () => {
        Kadira.tracer.eventEnd(kadiraInfo.trace, event);
      });

      // TODO: Look into preserving the default behavior when there
      // are no other listeners for the error event.
      stream.on('error', (error) => {
        Kadira.tracer.eventEnd(kadiraInfo.trace, event, {
          error: error
        })
      })
    }

    return stream;
  }
}
