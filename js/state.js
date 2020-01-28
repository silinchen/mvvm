function initState(vm) {
  const opts = vm.$options
  if (opts.data) {
    initData(vm)
  } else {
    observe(vm._data = {}, true)
  }
  if (opts.computed) initComputed(vm, opts.computed)
  // if (opts.watch && opts.watch !== nativeWatch) {
  //   initWatch(vm, opts.watch)
  // }
}

function initData(vm) {
  let data = vm.$options.data
  data = vm._data = typeof data === 'function' ?
    data.call(vm, vm) :
    data || {}
  // proxy data on instance
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  while (i--) {
    const key = keys[i]
    if (methods && hasOwn(methods, key)) {
      console.log(`Method "${key}" has already been defined as a data property.`, vm)
    }
    if (props && hasOwn(props, key)) {
      console.log(`The data property "${key}" is already declared as a prop. Use prop default value instead.`, vm)
    } else if (!isReserved(key)) {
      // 数据代理，实现 vm.xxx -> vm._data.xxx，相当于 vm 上面多了 xxx 这个属性
      proxy(vm, `_data`, key)
    }
  }
  // observe data
  observe(data, true)
}
// 数据代理
function proxy(target, sourceKey, key) {
  Object.defineProperty(target, key, {
    enumerable: true,
    configurable: true,
    get: function proxyGetter() {
      return this[sourceKey][key]
    },
    set: function proxySetter(val) {
      this[sourceKey][key] = val
    }
  })
}
// 初始化 computed，这里只是做了简单的处理，与 vue 实际实现方式有点差别
function initComputed(vm) {
  var computed = vm.$options.computed;
  if (typeof computed === 'object') {
    Object.keys(computed).forEach(function (key) {
      Object.defineProperty(vm, key, {
        get: typeof computed[key] === 'function' ?
          computed[key] :
          computed[key].get,
        set: function noop (a, b, c) {}
      });
    });
  }
}

/**
 * Check if a string starts with $ or _
 */
function isReserved (str) {
  const c = (str + '').charCodeAt(0)
  return c === 0x24 || c === 0x5F
}
/**
 * Check whether an object has the property.
 */
const hasOwnProperty = Object.prototype.hasOwnProperty
function hasOwn (obj, key) {
  return hasOwnProperty.call(obj, key)
}
