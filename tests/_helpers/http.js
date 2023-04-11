import { HTTP } from 'meteor/http';

export const asyncHttpGet = function (url) {
  return new Promise((resolve, reject) => {
    HTTP.get(url, function (err, res) {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
};
