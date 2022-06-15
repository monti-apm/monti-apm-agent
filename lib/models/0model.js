export function KadiraModel () {

}

KadiraModel.prototype._getDateId = function (timestamp) {
  const remainder = timestamp % (1000 * 60);
  const dateId = timestamp - remainder;
  return dateId;
};
