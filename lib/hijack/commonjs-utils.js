const logger = Npm.require('debug')('kadira:apm');
const path = require('path');

let meteorBootstrap = typeof __meteor_bootstrap__ === 'object' && __meteor_bootstrap__;
let serverDir = meteorBootstrap ? meteorBootstrap.serverDir : process.cwd();
let nodeRequire;

try {
  // eslint-disable-next-line global-require
  let nodeModule = require('node:module');

  nodeRequire = nodeModule.createRequire(serverDir);
} catch (err) {
  logger(`Failed to create native require: ${err}`);
}

export function tryResolve (modulePath) {
  if (!meteorBootstrap || !nodeRequire) {
    return false;
  }

  try {
    return nodeRequire.resolve(modulePath, {
      paths: [
        serverDir,
        path.resolve(serverDir, 'npm')
      ]
    });
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      return false;
    }

    throw err;
  }
}

export function checkModuleUsed (name) {
  let resolved = tryResolve(name);

  if (!resolved) {
    return false;
  }

  return !!nodeRequire.cache[resolved];
}
