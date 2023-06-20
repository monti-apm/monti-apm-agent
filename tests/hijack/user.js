import { TestData } from '../_helpers/globals';
import { addAsyncTest, callAsync, getLastMethodEvents, registerMethod } from '../_helpers/helpers';

addAsyncTest(
  'User - not logged in',
  async function (test) {
    let methodId = registerMethod(async function () {
      await TestData.insertAsync({ aa: 10 });

      return 'foo';
    });

    await callAsync(methodId);

    let events = getLastMethodEvents([0, 2, 3]);

    let expected = [
      ['start', null, { userId: null, params: '[]' }],
      ['wait', null, { waitOn: [] }, { at: 1, endAt: 1 }],
      ['async', null, {}, {
        nested: [
          ['db', null, { coll: 'tinytest-data', func: 'insertAsync' },
            {
              at: 1,
              endAt: 1
            }
          ],
          ['async', null, {}, { at: 1, endAt: 1 }]
        ],
        at: 1,
        endAt: 1
      }],
      ['complete']
    ];

    test.stableEqual(events, expected);
  }
);
