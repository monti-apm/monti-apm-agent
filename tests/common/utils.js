import {getLocalTime} from '../../lib/common/utils';

Tinytest.add(
  'Common utils - getLocalTime - with correct Date.now',
  function (test) {
    const now = getLocalTime();
    test.equal(now > 0, true);
    test.equal(typeof now, 'number');
  }
);

Tinytest.add(
  'Common utils - getLocalTime - with Date.now as Date object',
  function (test) {
    const oldDateNow = Date.now;
    Date.now = function () {
      return new Date();
    };

    test.equal(typeof Date.now().getTime(), 'number');
    const now = getLocalTime();
    test.equal(now > 0, true);
    test.equal(typeof now, 'number');

    Date.now = oldDateNow;
  }
);
