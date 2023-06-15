import { pick } from '../../utils';

export function getCursorData ({ type, cursor }) {
  const cursorDescription = cursor._cursorDescription;

  const payload = Object.assign(Object.create(null), {
    coll: cursorDescription.collectionName,
    selector: JSON.stringify(cursorDescription.selector),
    func: type,
    cursor: true
  });

  if (cursorDescription.options) {
    let cursorOptions = pick(cursorDescription.options, ['fields', 'projection', 'sort', 'limit']);
    for (let field in cursorOptions) {
      let value = cursorOptions[field];
      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }
      payload[field] = value;
    }
  }

  return { payload, cursorDescription };
}
