import { Meteor } from 'meteor/meteor';
import { WebApp } from 'meteor/webapp';
import path from 'path';

import '../imports/methods/performance';
import { Profiler } from '../imports/utils/profiler';

Meteor.rootPath = path.resolve('.');
Meteor.absolutePath = Meteor.rootPath.split(`${path.sep}.meteor`)[0];

Profiler.registerMethods();

Meteor.startup(async () => {
  WebApp.addHtmlAttributeHook(() => ({ 'data-theme': 'dark', class: 'dark' }));
});
