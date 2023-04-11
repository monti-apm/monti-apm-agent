import chalk from 'chalk';
import highlight from 'cli-highlight';
import { stringify } from 'yaml';

export function prettyLog (...args) {
  const label = args.length > 1 ? args[0] : '';
  const obj = args.length > 1 ? args[1] : args[0];

  const yaml = stringify(obj);

  if (label) {
    console.log(`${chalk.yellowBright(`${label}`)}`);
  }

  console.log(
    highlight(yaml?.trim() ?? '', { language: 'yaml', ignoreIllegals: true }),
  );
}
