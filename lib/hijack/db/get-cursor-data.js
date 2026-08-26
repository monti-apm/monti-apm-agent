export function getCursorData ({ type, cursor }) {
  const cursorDescription = cursor._cursorDescription;

  const payload = Object.assign(Object.create(null), {
    coll: cursorDescription.collectionName,
    selector: JSON.stringify(cursorDescription.selector),
    func: type,
    cursor: true
  });

  if (cursorDescription.options) {
    const fields = ['fields', 'projection', 'sort', 'limit'];

    for (let field of fields) {
      let value = cursorDescription.options[field];

      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }

      payload[field] = value;
    }
  }

  return { payload, cursorDescription };
}
