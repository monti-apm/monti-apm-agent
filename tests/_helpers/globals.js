import { Meteor } from 'meteor/meteor';

export const MethodStore = [];
export const TestData = new Meteor.Collection('tinytest-data');
export const TestDataRedis = new Meteor.Collection('tinytest-data-redis');
TestDataRedis.configureRedisOplog?.({});
export const TestDataRedisNoRaceProtection = new Meteor.Collection('tinytest-data-redis-NoRaceProtection');
TestDataRedisNoRaceProtection.configureRedisOplog?.({protectAgainstRaceConditions: false});
