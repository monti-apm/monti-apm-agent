export function isBetween (value, min, max) {
  return value >= min && value <= max;
}

export function mergeIntervals (a, b) {
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

export function mergeOverlappingIntervals (intervals) {
  console.time('mergeOverlappingIntervals');

  const result = [];

  const sorted = intervals.sort((a, b) => a[0] - b[0]);

  for (const interval of sorted) {
    const last = result[result.length - 1];

    const merge = last ? mergeIntervals(interval, last) : null;

    if (merge) {
      result[result.length - 1] = merge;
    } else {
      result.push(interval);
    }
  }

  console.timeEnd('mergeOverlappingIntervals');

  return result;
}

export function mergeSegmentIntervals (map) {
  const intervals = Array.from(map.values()).map(({ startTime, endTime }) => [startTime, endTime ? endTime : startTime]);

  return mergeOverlappingIntervals(intervals);
}
