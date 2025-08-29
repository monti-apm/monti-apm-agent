export default class TraceAggregator {
  constructor () {
    this._models = [];
  }

  registerModel (model, payloadField) {
    this._models.push({
      model,
      payloadField
    });
  }

  collectTraces () {
    let result = [];

    this._models.forEach(({ model }) => {
      let traces = model.tracerStore.collectTraces();
      traces.forEach(trace => {
        result.push(trace);
      });
    });

    return result;
  }

  buildPayload () {
    let result = Object.create(null);
    this._models.forEach(({ model, payloadField }) => {
      result[payloadField] = model.tracerStore.collectTraces();
    });

    return result;
  }
}
