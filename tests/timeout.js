import { TimeoutManager } from '../lib/hijack/timeout_manager';
import {expect } from 'chai';

Tinytest.add(
  'Method Timeout',
  function (test) {
    const oldTimeout = Kadira.options.trackingTimeout;

    Kadira.options.trackingTimeout = 250;

    let methodId = RegisterMethod(function () {
      Meteor._sleepForMs(500);

      return 'pong';
    });

    let client = GetMeteorClient();

    let error = null;

    TimeoutManager.bus.once('timeout', (kadiraInfo, err) => {
      error = err;
    });

    const lastId = TimeoutManager.id;

    let result = client.call(methodId);

    expect(TimeoutManager.id).to.be.greaterThan(lastId);
    expect(error).to.be.an('error').and.to.have.property('message', `Method Timeout (500ms): ${methodId}`);

    test.equal(result, 'pong');

    Kadira.options.trackingTimeout = oldTimeout;
  }
);
