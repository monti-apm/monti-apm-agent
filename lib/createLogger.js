import debug from 'debug';

/**
 * @param {string} name
 */
export function createLogger (name) {
  return debug(name);
}
