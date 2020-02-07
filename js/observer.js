// Vue 通过数据劫持+发布订阅模式，实现双向数据绑定
// 通过 Object.defaineProperty 实现数据劫持，不兼容 IE8 及以下浏览器
function observe(value) {
  if (!isObject(value)) {
    return
  }
  return new Observer(value);
}

class Observer {
  constructor (value) {
    this.value = value
    this.dep = new Dep()
    this.walk(value)
  }
  walk (obj) {
    const keys = Object.keys(obj)
    // 循环遍历，创建响应式对象
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }
}
// 核心实现
function defineReactive (obj, key) {
  const dep = new Dep()

  let val = obj[key]

  // 对子对象递归调用 observe 方法，这样就保证了无论 obj 的结构多复杂，
  // 它的所有子属性也能变成响应式的对象，
  // 这样我们访问或修改 obj 中一个嵌套较深的属性，也能触发 getter 和 setter。
  // 使 foo.bar 等多层的对象也可以实现响应式。
  let childOb = observe(val)

  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      // Dep.target 指向 watcher
      if (Dep.target) {
        // 依赖收集，每个使用到 data 里的值的地方，都会调用一次 get，然后就会被收集到一个数组中。
        dep.depend()
        if (childOb) {
          childOb.dep.depend()
        }
      }
      return val
    },
    set: function reactiveSetter (newVal) {
      // 当值没有变化时，直接返回
      if (newVal === val) {
        return
      }
      // 对 val 设置新的
      val = newVal
      // 如果新传入的值时一个对象，需要重新进行 observe，给对象的属性做响应式处理。
      childOb = observe(newVal)
      dep.notify()
    }
  })
}

let uid = 0

class Dep {
  static target;
  id;
  subs;

  constructor () {
    this.id = uid++
    // 存放 watcher 的地方
    this.subs = []
  }

  addSub (sub) {
    this.subs.push(sub)
  }

  depend () {
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }
  // 派发更新
  notify () {
    // stabilize the subscriber list first
    const subs = this.subs.slice()
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

Dep.target = null

/**
 * Quick object check - this is primarily used to tell
 * Objects from primitive values when we know the value
 * is a JSON-compliant type.
 */
function isObject (obj) {
  return obj !== null && typeof obj === 'object'
}