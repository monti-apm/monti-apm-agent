
export const asyncHttpGet = function (url) {
  return new Promise((resolve, reject) => {
    Package?.['http']?.HTTP?.get(url, function (err, res) {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
};
