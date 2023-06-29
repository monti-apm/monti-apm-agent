import { isNumber } from '../common/utils';

export function isBetween (value, min, max) {
  return value >= min && value <= max;
}

export function mergeTwoIntervals (a, b) {
  if (isBetween(a[1], b[0], b[1]) && isBetween(a[0], b[0], b[1])) {
    return b;
  }

  if (isBetween(a[0], b[0], b[1])) {
    return [b[0], a[1]];
  }

  if (isBetween(a[1], b[0], b[1])) {
    return [a[0], b[1]];
  }

  return null;
}

export function mergeParallelIntervalsArray (intervals) {
  const result = [];

  const sorted = intervals.sort((a, b) => a[0] - b[0]);

  for (const interval of sorted) {
    const last = result[result.length - 1];

    const merge = last ? mergeTwoIntervals(interval, last) : null;

    if (merge) {
      result[result.length - 1] = merge;
    } else {
      result.push([...interval]);
    }
  }

  return result;
}

export function subtractIntervals (arr1, arr2) {
  arr1.sort((a, b) => a[0] - b[0]);
  arr2.sort((a, b) => a[0] - b[0]);

  let result = [];
  let j = 0;

  for (let i = 0; i < arr1.length; i++) {
    let [start1, end1] = arr1[i];
    while (j < arr2.length) {
      let [start2, end2] = arr2[j];
      if (end2 < start1) {
        j++;
      } else if (start2 > end1) {
        break;
      } else {
        if (start2 > start1) {
          result.push([start1, start2]);
        }
        start1 = end2;
        if (start1 >= end1) {
          break;
        }
        j++;
      }
    }
    if (j >= arr2.length && start1 < end1) {
      result.push([start1, end1]);
    }
  }
  return result;
}

export function getTotalDuration (arr) {
  return arr.reduce((acc, [start, end]) => acc + (end - start), 0);
}

export function setEventDuration (event) {
  if (isNumber(event.duration)) {
    return;
  }

  const {at, endAt} = event;

  event.duration = isNumber(at) && isNumber(endAt) ? endAt - at : 0;
}
