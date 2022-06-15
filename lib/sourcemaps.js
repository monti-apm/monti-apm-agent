/* eslint-disable camelcase */
/* global __meteor_bootstrap__ */

import path from 'path';
import fs from 'fs';
import { WebApp } from 'meteor/webapp';
import { createLogger } from './createLogger';

const logger = createLogger('kadira:apm:sourcemaps');

// Meteor 1.7 and older used clientPaths
const clientPaths = __meteor_bootstrap__.configJson.clientPaths;
const clientArchs = __meteor_bootstrap__.configJson.clientArchs;
const serverDir = __meteor_bootstrap__.serverDir;

let absClientPaths;

if (clientArchs) {
  absClientPaths = clientArchs.reduce((result, arch) => {
    result[arch] = path.resolve(path.dirname(serverDir), arch);

    return result;
  }, {});
} else {
  absClientPaths = Object.keys(clientPaths).reduce((result, key) => {
    result[key] = path.resolve(serverDir, path.dirname(clientPaths[key]));

    return result;
  }, {});
}

export function handleApiResponse (body = {}) {
  const unavailable = [];

  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      logger('failed parsing body', e, body);
      return;
    }
  }

  const neededSourcemaps = body.neededSourcemaps || [];
  logger('body', neededSourcemaps);

  const promises = neededSourcemaps.map((sourcemap) => {
    if (!Kadira.options.uploadSourceMaps) {
      return unavailable.push(sourcemap);
    }

    return getSourcemapPath(sourcemap.arch, sourcemap.file.path)
      .then(function (sourceMapPath) {
        if (sourceMapPath === null) {
          unavailable.push(sourcemap);
        } else {
          sendSourcemap(sourcemap, sourceMapPath);
        }
      });
  });

  Promise.all(promises).then(function () {
    if (unavailable.length > 0) {
      logger('sending unavailable sourcemaps', unavailable);
      Kadira.coreApi.sendData({
        unavailableSourcemaps: unavailable
      })
        .then(function (dataBody) {
          handleApiResponse(dataBody);
        })
        .catch(function (err) {
          console.log('Monti APM: unable to send data', err);
        });
    }
  });
}

function sendSourcemap (sourcemap, sourcemapPath) {
  logger('Sending sourcemap', sourcemap, sourcemapPath);

  const stream = fs.createReadStream(sourcemapPath);

  stream.on('error', (err) => {
    console.log('Monti APM: error while uploading sourcemap', err);
  });

  const arch = sourcemap.arch;
  const archVersion = sourcemap.archVersion;
  const file = encodeURIComponent(sourcemap.file.path);

  Kadira.coreApi.sendStream(`/sourcemap?arch=${arch}&archVersion=${archVersion}&file=${file}`, stream)
    .catch(function (err) {
      console.log('Monti APM: error uploading sourcemap', err);
    });
}

function preparePath (urlPath) {
  urlPath = path.posix.normalize(urlPath);

  if (urlPath[0] === '/') {
    urlPath = urlPath.slice(1);
  }

  return urlPath;
}

function checkForDynamicImport (arch, urlPath) {
  const filePath = preparePath(urlPath);

  return new Promise(function (resolve) {
    const archPath = absClientPaths[arch];
    const dynamicPath = `${path.join(archPath, 'dynamic', filePath)}.map`;

    fs.stat(dynamicPath, function (err) {
      resolve(err ? null : dynamicPath);
    });
  });
}

function getSourcemapPath (arch, urlPath) {
  return new Promise((resolve, reject) => {
    const clientProgram = WebApp.clientPrograms[arch];

    if (!clientProgram || !clientProgram.manifest) {
      return resolve(null);
    }

    const fileInfo = clientProgram.manifest.find((file) => file.url && file.url.startsWith(urlPath));

    if (fileInfo && fileInfo.sourceMap) {
      return resolve(path.join(
        absClientPaths[arch],
        fileInfo.sourceMap
      ));
    }

    checkForDynamicImport(arch, urlPath).then(resolve).catch(reject);
  });
}
