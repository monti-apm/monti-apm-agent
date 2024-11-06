import chalk from 'chalk';
import highlight from 'cli-highlight';
import { stringify } from 'yaml';
import Diff from 'diff';

// Force color
chalk.level = 1;

export function diffStrings (a, b) {
  const diff = Diff.diffLines(b, a);

  let result = '';

  diff.forEach((part) => {
    const color = part.added ? 'green' : part.removed ? 'red' : 'grey';
    result += chalk[color](part.value);
  });

  return result;
}

export function sortedStringify (obj) {
  return stringify(obj, (_, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value)
        .sort()
        .reduce((sorted, key) => {
          sorted[key] = value[key];
          return sorted;
        }, {});
    }
    return value;
  });
}

export function diffObjects (a, b) {
  const yamlA = sortedStringify(a);
  const yamlB = sortedStringify(b);

  console.log(diffStrings(yamlA, yamlB));
}

export function prettyLog (...args) {
  const label = args.length > 1 ? args[0] : '';
  const obj = args.length > 1 ? args[1] : args[0];

  const yaml = stringify(obj) || '';

  if (label) {
    console.log(`${chalk.yellowBright(`${label}`)}`);
  }

  console.log(
    highlight(yaml.trim(), { language: 'yaml', ignoreIllegals: true }),
  );
}
