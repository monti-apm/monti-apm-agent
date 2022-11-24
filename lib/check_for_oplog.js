/* global Minimongo, LocalCollection, OplogCheck */

import { Tracker } from 'meteor/tracker';

// expose for testing purpose
OplogCheck = {};

OplogCheck.env = function () {
  if (!process.env.MONGO_OPLOG_URL) {
    return {
      code: 'NO_ENV',
      reason: "You haven't added oplog support for your the Meteor app.",
      solution: 'Add oplog support for your Meteor app. see: http://goo.gl/Co1jJc'
    };
  }
  return true;
};

OplogCheck.disableOplog = function (cursorDescription) {
  const { options } = cursorDescription;

  // Underscored version for Meteor pre 1.2
  if (options._disableOplog || options.disableOplog) {
    return {
      code: 'DISABLE_OPLOG',
      reason: "You've disabled oplog for this cursor explicitly with _disableOplog option."
    };
  }
  return true;
};

// when creating Minimongo.Matcher object, if that's throws an exception
// meteor won't do the oplog support
OplogCheck.miniMongoMatcher = function (cursorDescription) {
  if (Minimongo.Matcher) {
    try {
      let matcher = new Minimongo.Matcher(cursorDescription.selector);
      return true;
    } catch (ex) {
      return {
        code: 'MINIMONGO_MATCHER_ERROR',
        reason: `There's something wrong in your mongo query: ${ex.message}`,
        solution: 'Check your selector and change it accordingly.'
      };
    }
  } else {
    // If there is no Minimongo.Matcher, we don't need to check this
    return true;
  }
};

OplogCheck.miniMongoSorter = function (cursorDescription) {
  let matcher = new Minimongo.Matcher(cursorDescription.selector);
  if (Minimongo.Sorter && cursorDescription.options.sort) {
    try {
      let sorter = new Minimongo.Sorter(
        cursorDescription.options.sort,
        { matcher }
      );
      return true;
    } catch (ex) {
      return {
        code: 'MINIMONGO_SORTER_ERROR',
        reason: `Some of your sort specifiers are not supported: ${ex.message}`,
        solution: 'Check your sort specifiers and chage them accordingly.'
      };
    }
  } else {
    return true;
  }
};

OplogCheck.fields = function (cursorDescription) {
  let options = cursorDescription.options;

  // Checking `projection` for Meteor 2.6+
  const fields = options.fields || options.projection;

  if (fields) {
    try {
      LocalCollection._checkSupportedProjection(fields);
      return true;
    } catch (e) {
      if (e.name === 'MinimongoError') {
        return {
          code: 'NOT_SUPPORTED_FIELDS',
          reason: `Some of the field filters are not supported: ${e.message}`,
          solution: 'Try removing those field filters.'
        };
      }
      throw e;
    }
  }
  return true;
};

OplogCheck.skip = function (cursorDescription) {
  if (cursorDescription.options.skip) {
    return {
      code: 'SKIP_NOT_SUPPORTED',
      reason: 'Skip does not support with oplog.',
      solution: 'Try to avoid using skip. Use range queries instead: http://goo.gl/b522Av'
    };
  }

  return true;
};

OplogCheck.where = function (cursorDescription) {
  let matcher = new Minimongo.Matcher(cursorDescription.selector);
  if (matcher.hasWhere()) {
    return {
      code: 'WHERE_NOT_SUPPORTED',
      reason: 'Meteor does not support queries with $where.',
      solution: 'Try to remove $where from your query. Use some alternative.'
    };
  }

  return true;
};

OplogCheck.geo = function (cursorDescription) {
  let matcher = new Minimongo.Matcher(cursorDescription.selector);

  if (matcher.hasGeoQuery()) {
    return {
      code: 'GEO_NOT_SUPPORTED',
      reason: 'Meteor does not support queries with geo partial operators.',
      solution: 'Try to remove geo partial operators from your query if possible.'
    };
  }

  return true;
};

OplogCheck.limitButNoSort = function (cursorDescription) {
  let options = cursorDescription.options;

  if (options.limit && !options.sort) {
    return {
      code: 'LIMIT_NO_SORT',
      reason: 'Meteor oplog implementation does not support limit without a sort specifier.',
      solution: 'Try adding a sort specifier.'
    };
  }

  return true;
};

OplogCheck.thirdParty = function (cursorDescription, observerDriver) {
  if (Tracker.active && observerDriver.constructor.name !== 'OplogObserveDriver') {
    return {
      code: 'TRACKER_ACTIVE',
      reason: 'Observe driver detected inside an active tracker, you might be using a third party library (e.g "reactive-mongo").',
      solution: 'Check the library documentation, perhaps an option is missing.'
    };
  }
  return true;
};

OplogCheck.unknownReason = function (cursorDescription, driver) {
  if (driver && driver.constructor.name !== 'OplogObserveDriver') {
    return {
      code: 'UNKNOWN_REASON',
      reason: `Not using the Oplog Observe Driver for unknown reason. Driver: ${driver.constructor.name}`,
      solution: 'Check your third-party libraries.'
    };
  }
  return true;
};

let preRunningMatchers = [
  OplogCheck.env,
  OplogCheck.disableOplog,
  OplogCheck.miniMongoMatcher
];

let globalMatchers = [
  OplogCheck.fields,
  OplogCheck.skip,
  OplogCheck.where,
  OplogCheck.geo,
  OplogCheck.limitButNoSort,
  OplogCheck.miniMongoSorter,
  OplogCheck.thirdParty,
  OplogCheck.unknownReason,
];

Kadira.checkWhyNoOplog = function (cursorDescription, observerDriver) {
  if (typeof Minimongo === 'undefined') {
    return {
      code: 'CANNOT_DETECT',
      reason: "You are running an older Meteor version and Monti APM can't check oplog state.",
      solution: 'Try updating your Meteor app'
    };
  }

  let result = runMatchers(preRunningMatchers, cursorDescription, observerDriver);

  if (result !== true) {
    return result;
  }

  result = runMatchers(globalMatchers, cursorDescription, observerDriver);

  if (result !== true) {
    return result;
  }

  return {
    code: 'OPLOG_SUPPORTED',
    reason: "This query should support oplog. It's weird if it's not.",
    solution: "Please contact Kadira support and let's discuss."
  };
};

function runMatchers (matcherList, cursorDescription, observerDriver) {
  for (const matcher of matcherList) {
    const matched = matcher(cursorDescription, observerDriver);

    if (matched !== true) {
      return matched;
    }
  }

  return true;
}
