KadiraModel = function () {

};

KadiraModel.prototype._getDateId = function (timestamp) {
  let remainder = timestamp % (1000 * 60);
  let dateId = timestamp - remainder;
  return dateId;
};
