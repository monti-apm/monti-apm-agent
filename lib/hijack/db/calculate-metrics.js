export function calculateMetrics (cursorDescription, result, endData, kadiraInfo, previousTrackNextObject) {
  let coll = cursorDescription.collectionName;
  let query = cursorDescription.selector;
  let opts = cursorDescription.options;
  let docSize = Kadira.docSzCache.getSize(coll, query, opts, result) * result.length;
  endData.docSize = docSize;

  if (kadiraInfo) {
    if (kadiraInfo.trace.type === 'method') {
      Kadira.models.methods.trackDocSize(kadiraInfo.trace.name, docSize);
    } else if (kadiraInfo.trace.type === 'sub') {
      Kadira.models.pubsub.trackDocSize(kadiraInfo.trace.name, 'cursorFetches', docSize);
    }

    kadiraInfo.trackNextObject = previousTrackNextObject;
  } else {
    // Fetch with no kadira info are tracked as from a null method
    Kadira.models.methods.trackDocSize('<not-a-method-or-a-pub>', docSize);
  }
}
