let Jobs = Kadira.Jobs = {};

Jobs.getAsync = function (id, callback) {
  Kadira.coreApi.getJob(id)
    .then(function (data) {
      callback(null, data);
    })
    .catch(function (err) {
      callback(err);
    });
};


Jobs.setAsync = function (id, changes, callback) {
  Kadira.coreApi.updateJob(id, changes)
    .then(function (data) {
      callback(null, data);
    })
    .catch(function (err) {
      callback(err);
    });
};

Jobs.set = Kadira.wrapAsync(Jobs.setAsync);
Jobs.get = Kadira.wrapAsync(Jobs.getAsync);
