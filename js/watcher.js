class Watcher {
  constructor(vm, expOrFn, cb) {
    this.vm = vm
    this.cb = cb
    this.expOrFn = expOrFn;
    this.depIds = {};
    // 判断 expOrFn 是不是一个函数，如果不是函数会通过 parsePath 把它变成一个函数。
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
    } else {
      // parsePath 把 expOrFn 变成一个函数
      this.getter = parsePath(expOrFn) || function noop (a, b, c) {}
    }
    // 取值，触发依赖收集。
    this.value = this.get()
  }
  /**
   * 这里 Dep.target 指向 watcher 本身，然后会取值，取值触发对应属性的 getter 方法。
   * 此时 getter 方法里面使用的 Dep.target 就有值了。
   * 通过一系列的代码执行 dep.depend() -> Dep.target.addDep(dep) -> dep.addSub(watcher)
   * 最后把 watcher 存到 subs 数组里，完成依赖收集。 
   * 最后把 Dep.target 删除，保证来 Dep.target 在同一时间内只有唯一一个。
   */
  get() {
    Dep.target = this;
    const vm = this.vm
    let value = this.getter.call(vm, vm)
    Dep.target = null;
    return value
  }
  // 在触发 getter 的时候会调用 dep.depend() 方法，也就会执行 Dep.target.addDep(this)
  addDep(dep) {
    if (!this.depIds.hasOwnProperty(dep.id)) {
      dep.addSub(this);
      this.depIds[dep.id] = dep;
    }
  }
  update() {
    // value 是获取当前的值。
    // this.value 是 watcher 缓存的旧值，
    // 用来与改变后的当前值进行对比，如果前后值没有变化，就不进行更新
    const value = this.get()
    const oldValue = this.value
    if (value !== oldValue) {
      // 缓存新的值，下次操作用
      this.value = value
      // 以 vm 为 cb 的 this 值，调用 cb。
      // cb 就是 在 new watcher 使传入的更新函数。会把新的值传入通过更新函数，更新到视图上。
      this.cb.call(this.vm, value, oldValue)
    }
  }
}

/**
 * unicode letters used for parsing html tags, component names and property paths.
 * using https://www.w3.org/TR/html53/semantics-scripting.html#potentialcustomelementname
 * skipping \u10000-\uEFFFF due to it freezing up PhantomJS
 */
const unicodeRegExp = /a-zA-Z\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD/

/**
 * Parse simple path.
 */
const bailRE = new RegExp(`[^${unicodeRegExp.source}.$_\\d]`)
function parsePath (path) {
  if (bailRE.test(path)) {
    return
  }
  // 把表达式拆成数组，例如 foo.bar -> ['foo','bar']
  const segments = path.split('.')
  // 返回一个取值的方法，
  // 上述代码执行 this.getter.call(vm, vm)
  // 这里 getter 就是返回的这个函数，obj 参数就是 vm。
  return function (obj) {
    // 这里对数组进行循环处理，例如：数组是 ['foo','bar']，最后返回的是 vm['foo']['bar']
    for (let i = 0; i < segments.length; i++) {
      if (!obj) return
      obj = obj[segments[i]]
    }
    return obj
  }
}
