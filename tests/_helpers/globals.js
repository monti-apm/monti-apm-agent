import { Meteor } from 'meteor/meteor';

export const MethodStore = [];
export const TestData = new Meteor.Collection('tinytest-data');
export const TestDataRedis = new Meteor.Collection('tinytest-data-redis');
if (TestDataRedis.configureRedisOplog) TestDataRedis.configureRedisOplog({});
export const TestDataRedisNoRaceProtection = new Meteor.Collection('tinytest-data-redis-NoRaceProtection');
if (TestDataRedisNoRaceProtection.configureRedisOplog) TestDataRedisNoRaceProtection.configureRedisOplog({protectAgainstRaceConditions: false});
