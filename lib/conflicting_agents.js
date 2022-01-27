import { Meteor } from 'meteor/meteor';

const conflictingPackages = [
  'mdg:meteor-apm-agent',
  'lmachens:kadira',
  'meteorhacks:kadira'
];

Meteor.startup(() => {
  conflictingPackages.forEach(name => {
    if (name in Package) {
      console.log(
        `Monti APM: your app is using the ${name} package. Using more than one APM agent in an app can cause unexpected problems.`
      );
    }
  });
});
