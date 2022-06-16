import { Meteor } from 'meteor/meteor';

const commonErrRegExps = [
  /connection timeout\. no (\w*) heartbeat received/i,
  /INVALID_STATE_ERR/i,
];

Kadira.errorFilters = {
  filterValidationErrors (type, message, err) {
    if (err && err instanceof Meteor.Error) {
      return false;
    }
    return true;
  },

  filterCommonMeteorErrors (type, message) {
    for (let lc = 0; lc < commonErrRegExps.length; lc++) {
      const regExp = commonErrRegExps[lc];
      if (regExp.test(message)) {
        return false;
      }
    }
    return true;
  }
};
