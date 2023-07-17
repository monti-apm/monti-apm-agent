import { HTTP } from 'meteor/http';
import http from 'http';

export const asyncMeteorHttpGet = function (url) {
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

export const asyncNodeHttpGet = (url) => new Promise((resolve, reject) => {
  http.get(url, (res) => {
    resolve(res);
  }).on('error', (e) => {
    reject(e);
  });
});

export const getFullUrl = (req) => {
  const protocol = req.connection.encrypted ? 'https' : 'http';
  return `${protocol}://${req.headers.host}${req.url}`;
};
