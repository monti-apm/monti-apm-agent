import { Ntp } from '../lib/ntp';

Tinytest.add(
  'Ntp - ._now - with correct Date.now',
  function (test) {
    let now = Ntp._now();
    test.equal(now > 0, true);
    test.equal(typeof now, 'number');
  }
);

Tinytest.add(
  'Ntp - ._now - with Date.now as Date object',
  function (test) {
    let oldDateNow = Date.now;
    Date.now = function () {
      return new Date();
    };

    test.equal(typeof Date.now().getTime(), 'number');
    let now = Ntp._now();
    test.equal(now > 0, true);
    test.equal(typeof now, 'number');

    Date.now = oldDateNow;
  }
);
