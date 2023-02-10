import { Meteor } from 'meteor/meteor';
import { WebApp } from 'meteor/webapp';

import '../imports/methods/performance';

Meteor.startup(async () => {
  WebApp.addHtmlAttributeHook(() => ({ 'data-theme': 'light' }));
});
