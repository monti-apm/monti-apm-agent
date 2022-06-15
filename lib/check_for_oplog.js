/* global Kadira, Minimongo, LocalCollection */

import { Meteor } from 'meteor/meteor';
import { _ } from 'meteor/underscore';

// expose for testing purpose
export const OplogCheck = {
  _070 (cursorDescription) {
    let options = cursorDescription.options;
    if (options.limit) {
      return {
        code: '070_LIMIT_NOT_SUPPORTED',
        reason: 'Meteor 0.7.0 does not support limit with oplog.',
        solution: 'Upgrade your app to Meteor version 0.7.2 or later.'
      };
    }

    let exists$ = _.any(cursorDescription.selector, function (value, field) {
      if (field.substr(0, 1) === '$') {
        return true;
      }
    });

    if (exists$) {
      return {
        code: '070_$_NOT_SUPPORTED',
        reason: 'Meteor 0.7.0 supports only equal checks with oplog.',
        solution: 'Upgrade your app to Meteor version 0.7.2 or later.'
      };
    }

    let onlyScalers = _.all(cursorDescription.selector, function (value) {
      return typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value === null ||
        value instanceof Meteor.Collection.ObjectID;
    });

    if (!onlyScalers) {
      return {
        code: '070_ONLY_SCALERS',
        reason: 'Meteor 0.7.0 only supports scalers as comparators.',
        solution: 'Upgrade your app to Meteor version 0.7.2 or later.'
      };
    }

    return true;
  },
  _071 (cursorDescription) {
    const options = cursorDescription.options;
    const matcher = new Minimongo.Matcher(cursorDescription.selector);
    if (options.limit) {
      return {
        code: '071_LIMIT_NOT_SUPPORTED',
        reason: 'Meteor 0.7.1 does not support limit with oplog.',
        solution: 'Upgrade your app to Meteor version 0.7.2 or later.'
      };
    }

    return true;
  },
  env () {
    if (!process.env.MONGO_OPLOG_URL) {
      return {
        code: 'NO_ENV',
        reason: "You haven't added oplog support for your the Meteor app.",
        solution: 'Add oplog support for your Meteor app. see: http://goo.gl/Co1jJc'
      };
    }
    return true;
  },
  disableOplog (cursorDescription) {
    if (cursorDescription.options._disableOplog) {
      return {
        code: 'DISABLE_OPLOG',
        reason: "You've disable oplog for this cursor explicitly with _disableOplog option."
      };
    }
    return true;
  },
  // when creating Minimongo.Matcher object, if that's throws an exception
  // meteor won't do the oplog support
  miniMongoMatcher (cursorDescription) {
    if (Minimongo.Matcher) {
      try {
        const matcher = new Minimongo.Matcher(cursorDescription.selector);
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
  },
  miniMongoSorter (cursorDescription) {
    const matcher = new Minimongo.Matcher(cursorDescription.selector);
    if (Minimongo.Sorter && cursorDescription.options.sort) {
      try {
        const sorter = new Minimongo.Sorter(
          cursorDescription.options.sort,
          {matcher}
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
  },
  fields (cursorDescription) {
    let options = cursorDescription.options;
    if (options.fields) {
      try {
        LocalCollection._checkSupportedProjection(options.fields);
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
  },
  skip (cursorDescription) {
    if (cursorDescription.options.skip) {
      return {
        code: 'SKIP_NOT_SUPPORTED',
        reason: 'Skip does not support with oplog.',
        solution: 'Try to avoid using skip. Use range queries instead: http://goo.gl/b522Av'
      };
    }

    return true;
  },
  where (cursorDescription) {
    let matcher = new Minimongo.Matcher(cursorDescription.selector);
    if (matcher.hasWhere()) {
      return {
        code: 'WHERE_NOT_SUPPORTED',
        reason: 'Meteor does not support queries with $where.',
        solution: 'Try to remove $where from your query. Use some alternative.'
      };
    }

    return true;
  },
  geo (cursorDescription) {
    let matcher = new Minimongo.Matcher(cursorDescription.selector);

    if (matcher.hasGeoQuery()) {
      return {
        code: 'GEO_NOT_SUPPORTED',
        reason: 'Meteor does not support queries with geo partial operators.',
        solution: 'Try to remove geo partial operators from your query if possible.'
      };
    }

    return true;
  },
  limitButNoSort (cursorDescription) {
    let options = cursorDescription.options;

    if (options.limit && !options.sort) {
      return {
        code: 'LIMIT_NO_SORT',
        reason: 'Meteor oplog implementation does not support limit without a sort specifier.',
        solution: 'Try adding a sort specifier.'
      };
    }

    return true;
  },
  olderVersion (cursorDescription, driver) {
    if (driver && !driver.constructor.cursorSupported) {
      return {
        code: 'OLDER_VERSION',
        reason: 'Your Meteor version does not have oplog support.',
        solution: 'Upgrade your app to Meteor version 0.7.2 or later.'
      };
    }
    return true;
  },
  gitCheckout () {
    if (!Meteor.release) {
      return {
        code: 'GIT_CHECKOUT',
        reason: "Seems like your Meteor version is based on a Git checkout and it doesn't have the oplog support.",
        solution: 'Try to upgrade your Meteor version.'
      };
    }
    return true;
  }
};

const preRunningMatchers = [
  OplogCheck.env,
  OplogCheck.disableOplog,
  OplogCheck.miniMongoMatcher
];

const globalMatchers = [
  OplogCheck.fields,
  OplogCheck.skip,
  OplogCheck.where,
  OplogCheck.geo,
  OplogCheck.limitButNoSort,
  OplogCheck.miniMongoSorter,
  OplogCheck.olderVersion,
  OplogCheck.gitCheckout
];

const versionMatchers = [
  [/^0\.7\.1/, OplogCheck._071],
  [/^0\.7\.0/, OplogCheck._070],
];

Kadira.checkWhyNoOplog = function (cursorDescription, observerDriver) {
  if (typeof Minimongo === 'undefined') {
    return {
      code: 'CANNOT_DETECT',
      reason: "You are running an older Meteor version and Kadira can't check oplog state.",
      solution: 'Try updating your Meteor app'
    };
  }

  let result = runMatchers(preRunningMatchers, cursorDescription, observerDriver);
  if (result !== true) {
    return result;
  }

  const meteorVersion = Meteor.release;
  for (let lc = 0; lc < versionMatchers.length; lc++) {
    let matcherInfo = versionMatchers[lc];
    if (matcherInfo[0].test(meteorVersion)) {
      let matched = matcherInfo[1](cursorDescription, observerDriver);
      if (matched !== true) {
        return matched;
      }
    }
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
  for (let lc = 0; lc < matcherList.length; lc++) {
    const matcher = matcherList[lc];
    const matched = matcher(cursorDescription, observerDriver);
    if (matched !== true) {
      return matched;
    }
  }
  return true;
}
