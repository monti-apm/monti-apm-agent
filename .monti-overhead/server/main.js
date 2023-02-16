import { Meteor } from 'meteor/meteor';
import { WebApp } from 'meteor/webapp';
import path from 'path';

import '../imports/methods/performance';
import { Profiler } from '../imports/utils/profiler';
import { LinksCollection } from '../imports/api/links';

Meteor.rootPath = path.resolve('.');
Meteor.absolutePath = Meteor.rootPath.split(`${path.sep}.meteor`)[0];

Profiler.registerMethods();

Meteor.startup(async () => {
  if (LinksCollection.find().count() === 0) {
    for (let i = 0; i < 10000; i++) {
      LinksCollection.insert({ title: `Link ${i}`, url: `http://link-${i}.com` });
    }
  }

  WebApp.addHtmlAttributeHook(() => ({ 'data-theme': 'dark', class: 'dark' }));
});
