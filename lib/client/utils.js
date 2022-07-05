import { Meteor } from 'meteor/meteor';

export function getBrowserInfo () {
  return {
    browser: window.navigator.userAgent,
    userId: Meteor.userId && Meteor.userId(),
    url: window.location.href,
    resolution: getResolution(),
    clientArch: getClientArch(),
  };
}

function getResolution () {
  const screen = window.screen;
  if (screen && screen.width && screen.height) {
    return `${screen.width}x${screen.height}`;
  }
}

const toArray = (...args) => args;

export function getErrorStack (zone, callback) {
  let trace = [];
  let eventMap = zone.eventMap || {};
  let infoMap = zone.infoMap || {};

  trace.push({
    at: new Date().getTime(),
    stack: zone.erroredStack.get()
  });

  processZone();
  function processZone () {
    // we assume, first two zones are not interesting
    // bacause, they are some internal meteor loading stuffs
    if (zone && zone.depth > 2) {
      let stack = '';
      if (zone.currentStack) {
        stack = zone.currentStack.get();
      }

      let events = eventMap[zone.id] || [];
      let info = getInfoArray(infoMap[zone.id]);
      let ownerArgsEvent = events && events[0] && events[0].type == 'owner-args' && events.shift();
      let runAt = ownerArgsEvent ? ownerArgsEvent.at : zone.runAt;
      let ownerArgs = ownerArgsEvent ? toArray.apply(null, ownerArgsEvent.args) : [];

      // limiting
      events = events.slice(-5).map(checkSizeAndPickFields(100));
      info = info.slice(-5).map(checkSizeAndPickFields(100));
      ownerArgs = checkSizeAndPickFields(200)(ownerArgs.slice(0,5));

      zone.owner && delete zone.owner.zoneId;

      trace.push({
        createdAt: zone.createdAt,
        runAt,
        stack,
        owner: zone.owner,
        ownerArgs,
        events,
        info,
        zoneId: zone.id
      });
      zone = zone.parent;

      setTimeout(processZone, 0);
    } else {
      callback(trace);
    }
  }
}

function getInfoArray (info = {}) {
  return Object.keys(info)
    .map(function (key, type) {
      const value = info[key];
      value.type = type;
      return value;
    });
}

export function getClientArch () {
  if (Meteor.isCordova) {
    return 'cordova.web';
  } else if (typeof Meteor.isModern === 'undefined' || Meteor.isModern) {
    return 'web.browser';
  }
  return 'web.browser.legacy';
}

export function checkSizeAndPickFields (maxFieldSize) {
  return function (obj) {
    maxFieldSize = maxFieldSize || 100;
    for (let key in obj) {
      let value = obj[key];
      try {
        let valueStringified = JSON.stringify(value);
        if (valueStringified.length > maxFieldSize) {
          obj[key] = `${valueStringified.substr(0, maxFieldSize)} ...`;
        } else {
          obj[key] = value;
        }
      } catch (ex) {
        obj[key] = 'Error: cannot stringify value';
      }
    }
    return obj;
  };
}
