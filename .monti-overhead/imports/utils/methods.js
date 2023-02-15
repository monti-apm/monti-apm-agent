import { check } from 'meteor/check';
import { flow } from 'lodash';
import { intercept } from './func';
import SimpleSchema from 'simpl-schema';


/**
 * Promisifies method calls.
 */
export function call (name, params = {}) {
  return new Promise((resolve, reject) => {
    Meteor.call(name, params, (error, result) => {
      if (error) reject(error);
      resolve(result);
    });
  });
}

export function method (name, func, options = {}) {
  const { schema, middleware = [] } = options;

  if (schema) check(schema, SimpleSchema);

  check(middleware, Array);

  Meteor.methods({
    [name] (params) {
      schema?.validate(params);

      const wrapped = middleware.map(m => intercept.call(this, m));

      const result = flow(...wrapped).call(this, params);

      return func.call(this, result);
    },
  });
}
