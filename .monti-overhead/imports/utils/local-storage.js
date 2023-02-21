import { EJSON } from 'ejson2';

export function getJSONFromLocalStorage(key) {
  return EJSON.parse(localStorage.getItem(key) || 'null')
}

export function setJSONToLocalStorage(key, value) {
  localStorage.setItem(key, EJSON.stringify(value))
}
