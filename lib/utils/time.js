import { isNumber } from '../common/utils';

export function mergeIntervals (intervals) {
  if (!intervals?.length) return intervals;

  intervals.sort((a, b) => a[0] - b[0]);

  const mergedIntervals = [];
  let currentInterval = intervals[0];

  for (let i = 1; i < intervals.length; i++) {
    const interval = intervals[i];

    if (currentInterval[1] >= interval[0]) {
      currentInterval[1] = Math.max(currentInterval[1], interval[1]);
    } else {
      mergedIntervals.push(currentInterval);
      currentInterval = interval;
    }
  }

  mergedIntervals.push(currentInterval);

  return mergedIntervals;
}


/**
 * Subtract intervals from `arr1` by intervals from `arr2.`
 *
 * @param arr1
 * @param arr2
 * @returns {*[]}
 */
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
