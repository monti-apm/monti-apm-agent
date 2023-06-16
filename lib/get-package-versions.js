const fs = Npm.require('fs');

// Based on https://github.com/meteor/meteor/blob/d9db4f52f2ea6d706a25156768ea42e1fbb8f599/tools/utils/utils.js#L250
function parsePackageAndVersion (packageAtVersionString) {
  const separatorPos = Math.max(packageAtVersionString.lastIndexOf(' '),
    packageAtVersionString.lastIndexOf('@'));

  if (separatorPos < 0) {
    return;
  }

  const packageName = packageAtVersionString.slice(0, separatorPos);
  const version = packageAtVersionString.slice(separatorPos + 1);

  return { package: packageName, version };
}

// Based on https://github.com/zodern/meteor-package-versions/blob/master/plugin.js
export function getPackageVersions () {
  let contents;

  try {
    contents = fs.readFileSync('./.meteor/versions', 'utf-8');
  } catch (e) {
    if (!Meteor.isPackageTest) {
      console.log('Monti APM: Unable to read .meteor/versions at ', process.cwd());
      console.error('Monti APM:', e.message);
    }
    return {};
  }

  const lines = contents.split(/\r*\n\r*/);

  const versions = {};

  // Based on https://github.com/meteor/meteor/blob/d9db4f52f2ea6d706a25156768ea42e1fbb8f599/tools/project-context.js#L1171
  lines.forEach(line => {
    line = line.replace(/^\s+|\s+$/g, '');

    if (line === '')
      return;

    const packageVersion = parsePackageAndVersion(line);

    if (!packageVersion)
      return;

    // If a package is in the file multiple times, Meteor only uses the first entry
    if (packageVersion.package in versions)
      return;

    versions[packageVersion.package] = packageVersion.version;
  });

  return versions;
}
