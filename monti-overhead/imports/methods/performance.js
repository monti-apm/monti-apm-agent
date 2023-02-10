
Meteor.methods({
  echo (msg) {
    return msg;
  },

  getMemoryUsage () {
    const memory = process.memoryUsage();

    return {
      rss: memory.rss / 1024,
      heapTotal: memory.heapTotal / 1024,
      heapUsed: memory.heapUsed / 1024,
      external: memory.external / 1024,
    };
  }
});
