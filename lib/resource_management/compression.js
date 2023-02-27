import zlib from 'zlib';

export function gzipObject (obj) {
  return new Promise((resolve, reject) => {
    const jsonString = JSON.stringify(obj);
    zlib.gzip(jsonString, (error, compressedData) => {
      if (error) {
        reject(error);
      } else {
        resolve(compressedData);
      }
    });
  });
}

export function gzipDeflateObject (buffer) {
  return new Promise((resolve, reject) => {
    zlib.gunzip(buffer, (error, data) => {
      if (error) {
        reject(error);
      } else {
        resolve(JSON.parse(data.toString('utf8')));
      }
    });
  });
}
