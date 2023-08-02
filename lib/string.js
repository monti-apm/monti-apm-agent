export const generateRandomString = (size) => `random::${Array.from({length: size}, () => Math.floor(Math.random() * 36).toString(36)).join('')}`;
