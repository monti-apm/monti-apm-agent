import { setCurrentEvent } from '../async-context';

export function wrap (event, after, originalFn, context, args) {
  let info = Kadira._getInfo();

  if (!info) {
    return originalFn.apply(context, args);
  }

  let reset;
  try {
    reset = setCurrentEvent(event);
    let result = originalFn.apply(context, args);
    if (isThenable(result)) {
      result.then((resolvedValue) => {
        let data = after(resolvedValue);
        Kadira.tracer.eventEnd(info.trace, event, data);

        return resolvedValue;
      });
    } else {
      let data = after(result);
      Kadira.tracer.eventEnd(info.trace, event, data);
    }

    return result;
  } catch (e) {
    Kadira.tracer.eventEnd(
      info.trace,
      event,
      { err: e.message }
    );
  } finally {
    reset();
  }
}

function isThenable(obj) {
  return obj && typeof obj === 'object' && typeof obj.then === 'function';
}
