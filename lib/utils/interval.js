export class Interval {
  constructor (start, end) {
    this.start = start;
    this.end = end;
  }
}

export class IntervalNode {
  constructor (interval) {
    this.interval = interval;
    this.maxEnd = interval.end;
    this.left = null;
    this.right = null;
  }
}

export class IntervalTree {
  constructor () {
    this.root = null;
  }

  insert (interval) {
    this.root = this.insertNode(this.root, interval);
  }

  insertNode (node, interval) {
    if (node === null) {
      return new IntervalNode(interval);
    }

    if (interval.end > node.maxEnd) {
      node.maxEnd = interval.end;
    }

    if (interval.start < node.interval.start) {
      node.left = this.insertNode(node.left, interval);
    } else {
      node.right = this.insertNode(node.right, interval);
    }

    return node;
  }

  search (interval) {
    return this.searchNode(this.root, interval);
  }

  searchNode (node, interval) {
    if (node === null) {
      return [];
    }

    if (node.interval.start <= interval.end && node.interval.end >= interval.start) {
      return [node.interval];
    }

    if (node.left !== null && node.left.maxEnd >= interval.start) {
      return this.searchNode(node.left, interval);
    }

    return this.searchNode(node.right, interval);
  }
}
