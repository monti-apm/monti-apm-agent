import { useCreation, useThrottleEffect, useUpdate } from 'ahooks';

import { useRef } from 'react';
import { isFunction, isObject } from 'lodash';
import { getJSONFromLocalStorage, setJSONToLocalStorage } from '../utils/local-storage';

const proxyMap = new WeakMap()
const rawMap = new WeakMap()

function observer(initialVal, cb) {
  const existingProxy = proxyMap.get(initialVal)

  if (existingProxy) {
    return existingProxy
  }

  if (rawMap.has(initialVal)) {
    return initialVal
  }

  const proxy = new Proxy(initialVal, {
    get(target, key, receiver) {
      const res = Reflect.get(target, key, receiver)

      // Fixes Date objects not being able to be serialized.
      if (isFunction(res)) {
        return res.bind(target)
      }

      return isObject(res) ? observer(res, cb) : res
    },
    set(target, key, val) {
      const ret = Reflect.set(target, key, val)
      cb()
      return ret
    },
    deleteProperty(target, key) {
      const ret = Reflect.deleteProperty(target, key)
      cb()
      return ret
    },
  })

  proxyMap.set(initialVal, proxy)
  rawMap.set(proxy, initialVal)

  return proxy
}

/**
 * This is a better version of `useReactive` from ahooks, which works
 * well with dates.
 *
 * @param initialState
 * @returns {unknown}
 */
export function useReactive(initialState) {
  const update = useUpdate()
  const stateRef = useRef(initialState)

  return useCreation(() => observer(stateRef.current, update), [])
}

export function useReactiveLocalStorage(key, initialValues) {
  const state = useReactive(getJSONFromLocalStorage(key) || initialValues)

  useThrottleEffect(
    () => {
      setJSONToLocalStorage(key, state)
    },
    Object.values(state),
    { wait: 1000, leading: true, trailing: true },
  )

  return state
}
