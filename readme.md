# 从零实现一个简单的Vue框架，掌握MVVM框架原理

## 一、准备工作

### 1. 什么是 MVVM 框架？

MVVM 是 Model-View-ViewModel 的简写，双向数据绑定，即视图影响模型，模型影响数据。它本质上就是MVC 的改进版。

- Model（模型）是数据访问层，例如后台接口传递的数据
- View（视图）是用户在屏幕上看到的页面的结构、布局、外观（UI）
- ViewModel（视图模型）负责将 View 的变化同步到 Model，或 Model 的变化转化为 View。

### 2. Vue 怎么实现双向数据绑定

  Vue2.x 是通过 [Object.defineProperty](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty) 实现的双向数据绑定，该方法不支持 ie8 及以下版本。
  相关语法直接查看[文档](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty)。
  其中，属性描述符有很多个，下面简单说明一下常用的几个，具体详细内容直接查看文档。
  下面是给定义 obj 对象定义一个名称为 Vue 的属性。

```javascript
Object.defineProperty(obj, 'vue', {
  configurable: true,
  writable: true,
  enmerbale: true,
  value: 'Hello, Vue',
  get() {
    return 'Hello, Vue'
  }
  set(val) {
    console.log(val)
  }
})
```

**configurable**: 指定属性是否可以配置，如果不设置为true，则无法删除该属性，例如：delete obj.vue='react'无效
**writable**:  指定属性是否能被赋值运算符改变，如果不设置为true，则给 vue 属性赋值，例如：obj.vue='react'无效
**enmerbale**: 指定属性是否可以被枚举到，如果不设置为true，使用 for...in... 或 Object.keys 是读不到该属性的
**value**:  指定属性对应的值，与 get 属性冲突，一起使用会报错
**get**:  访问该属性时，如果有设置 get 方法，会执行这个方法并返回
**set**:  修改该属性值时，如果有设置 set 方法，会执行这个方法，并把新的值作为参数传进入 object.vue = 'hello, Vuex'

### 3. 流程图

![流程图](https://github.com/silinchen/mvvm/blob/master/img/mvvm.png)

### 4. 流程分析

这里我们先看看代码实现，大概了解一下整个过程，最后再对整个过程进行分析。

结合代码、注释、过程分析可以更好的理解整个过程。



## 二、开始实现

*参考 [Vue2.x](https://github.com/vuejs/vue) 源码实现，与实际 [Vue](https://github.com/vuejs/vue) 的实现有差别，但原理上差不多。建议看完可以继续深入学习 Vue 实际源码*

### 1. Vue 入口

```javascript
// 模拟 Vue 的入口
function MVVM(options) {
    var vm = this;
    vm.$options = options || {};
    vm._data = vm.$options.data;
    /**
     * initState 主要对数据对处理
     * 实现 observe，即对 data／computed 等做响应式处理以及将数据代理到 vm 实例上
     */
    initState(vm)
		// 编译模版
    this.$compile = new Compile(options.el || document.body, this)
}
```

### 2. 模版编译

这里的 Compile 只是简单的模版编译，与 Vue 实际Compile 有较大区别，实际的 Compile 实现比较复杂，需要经过 parse、optimize、generate 三个阶段处理。

- parse: 使用正则解析template中的vue的指令(v-xxx) 变量等等 形成抽象语法树AST
- optimize: 标记一些静态节点，用作后面的性能优化，在diff的时候直接略过
- generate: 把第一部生成的AST 转化为渲染函数 render function

```javascript
function Compile(el, vm) {
  this.$vm = vm;
  this.$el = this.isElementNode(el) ? el : document.querySelector(el);

  if (this.$el) {
    // 将原生节点转为文档碎片节点，提高操作效率
    this.$fragment = this.node2Fragment(this.$el);
    // 编译模版内容，同时进行依赖收集
    this.compile(this.$fragment);
    // 将处理后的 dom 树挂载到真实 dom 节点中
    this.$el.appendChild(this.$fragment);
  }
}
// compile 相关方法实现
Compile.prototype = {
  node2Fragment(el) {
    const fragment = document.createDocumentFragment();
    /**
     * 将原生节点拷贝到 fragment，
     * 每次循环都会把 el 中的第一个节点取出来追加到 fragment 后面，直到 el 没有字节点
     */
    let child;
    while (child = el.firstChild) {
      fragment.appendChild(child);
    }
  
    return fragment;
  },
  compile: function (el) {
    const childNodes = el.childNodes
    // childNodes 不是标准数组，通过 Array.from 把 childNodes 转成数组并遍历处理每一个节点。
    Array.from(childNodes).forEach(node => {
      // 利用闭包机制，保存文本节点最初的文本，后面更新根据最初的文本进行替换更新。
      const text = node.textContent;
      // 元素节点，对元素属性绑定对指令进行处理
      if (this.isElementNode(node)) {
        this.compileElement(node);
      }
      // 文本节点并且包含 {{xx}} 字符串对文本，模版内容替换
      else if (this.isTextNode(node) && /\{\{(.*)\}\}/.test(text)) {
        this.compileText(node, RegExp.$1.trim(), text);
      }
      // 递归编译子节点的内容
      if (node.childNodes && node.childNodes.length) {
        this.compile(node);
      }
    });
  },

  compileElement: function (node) {
    const nodeAttrs = node.attributes

    Array.from(nodeAttrs).forEach(attr => {
      const attrName = attr.name;
      // 判断属性是否是一个指令，例如： v-text 等
      if (this.isDirective(attrName)) {
        const exp = attr.value;
        const dir = attrName.substring(2);
        // 事件指令
        if (this.isEventDirective(dir)) {
          compileUtil.eventHandler(node, this.$vm, exp, dir);
        }
        // 普通指令
        else {
          compileUtil[dir] && compileUtil[dir](node, this.$vm, exp);
        }
        node.removeAttribute(attrName);
      }
    });
  },

  compileText: function (node, exp) {
    // compileUtil.text(node, this.$vm, exp);
    // 利用闭包机制，保存文本节点最初的文本，后面更新根据最初的文本进行替换更新。
    const vm = this.$vm
    let text = node.textContent
    const updaterFn = updater.textUpdater

    let value = text.replace(/\{\{(.*)\}\}/, compileUtil._getVMVal(vm, exp))
    updaterFn && updaterFn(node, value);

    new Watcher(vm, exp, function (value) {
      updaterFn && updaterFn(node, text.replace(/\{\{(.*)\}\}/, value));
    });
  },

  isDirective: function (attr) {
    return attr.indexOf('v-') == 0;
  },

  isEventDirective: function (dir) {
    return dir.indexOf('on') === 0;
  },

  isElementNode: function (node) {
    return node.nodeType == 1;
  },

  isTextNode: function (node) {
    return node.nodeType == 3;
  }
};
```

指令集合处理

```javascript
// 指令处理集合
const compileUtil = {
  text: function (node, vm, exp) {
    this.update(node, vm, exp, 'text');
  },
	... // 省略
  update: function (node, vm, exp, dir) {
    // 针对不同的指令使用不同的函数渲染、更新数据。
    const updaterFn = updater[dir + 'Updater'];
    // 这里取值，然后进行初次的内容渲染
    updaterFn && updaterFn(node, this._getVMVal(vm, exp));
    new Watcher(vm, exp, function (value, oldValue) {
      updaterFn && updaterFn(node, value, oldValue);
    });
  },
 	... // 省略
};
  
const updater = {
  textUpdater: function (node, value) {
    node.textContent = typeof value == 'undefined' ? '' : value;
  },
  ... // 省略
};
```

### 3. 响应式对象

####initState

`initState` 方法主要是对 `props`、`methods`、`data`、`computed` 和 `wathcer` 等属性做了初始化操作。这里我们主要实现对 `data` 跟 `computed` 的操作。

```javascript
function initState(vm) {
  const opts = vm.$options
  // 初始化 data
  if (opts.data) {
    initData(vm)
  } else {
    observe(vm._data = {}, true)
  }
  // 初始化 computed
  if (opts.computed) initComputed(vm, opts.computed)
}
```

#### initData

主要实现以下两个操作：

1. 调用 `observe` 方法观测整个 `data` 的变化，把 `data` 也变成响应式，可以通过 `vm._data.xxx` 访问到定义 `data` 返回函数中对应的属性。

2. 对定义 `data` 函数返回对象的遍历，通过 `proxy` 把每一个值 `vm._data.xxx` 都代理到 `vm.xxx` 上。

```javascript
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
```

####  proxy

把每一个值 `vm._data.xxx` 都代理到 `vm.xxx` 上。

这是一个公用的方法。这里我们只是对 data 定义对属性做里代理。实际上 vue 还通过这个方法对 props 也做了代理，`proxy(vm, '_props', key)`

````javascript
// 数据代理，proxy(vm, '_data', key)。
function proxy(target, sourceKey, key) {
  Object.defineProperty(target, key, {
    enumerable: true,
    configurable: true,
    get: function proxyGetter() {
      // initData 里把 vm._data 处理成响应式对象。
      // 这里返回 this['_data'][key]，实现 vm[key] -> vm._data[key]
      return this[sourceKey][key]
    },
    set: function proxySetter(val) {
      // 这里修改 vm[key] 实际上是修改了 this['_data'][key]
      this[sourceKey][key] = val
    }
  })
}
````

#### observe

`observe` 的功能就是用来监测数据的变化。

```javascript
function observe(value) {
  if (!isObject(value)) {
    return
  }
  return new Observer(value);
}
```

#### Observer

`Observer` 是一个类，它的作用是给对象的属性添加 getter 和 setter，用于依赖收集和派发更新

```javascript
class Observer {
  constructor (value) {
    this.value = value
    this.dep = new Dep()
    this.walk(value)
  }
  walk (obj) {
    // 遍历 data 对象的 key 调用 defineReactive 方法创建响应式对象
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }
}
```
#### defineReactive

`defineReactive` 的功能就是定义一个响应式对象，给对象动态添加 getter 和 setter，getter 做的事情是依赖收集，setter 做的事情是派发更新。

```javascript
function defineReactive (obj, key) {
	// 初始化 Dep，用于依赖收集
  const dep = new Dep()

  let val = obj[key]

	// 对子对象递归调用 observe 方法，这样就保证了无论 obj 的结构多复杂，
  // 它的所有子属性也能变成响应式的对象，
  // 这样我们访问或修改 obj 中一个嵌套较深的属性，也能触发 getter 和 setter。
  // 使 foo.bar 等多层的对象也可以实现响应式。
  let childOb = observe(val)
  // Object.defineProperty 去给 obj 的属性 key 添加 getter 和 setter
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
```

### 4.依赖收集、派发更新

#### Dep

`Dep` 是整个 getter 依赖收集的核心，这里需要特别注意的是它有一个静态属性 `target`，这是一个全局唯一 `Watcher`，这是一个非常巧妙的设计，因为在同一时间只能有一个全局的 `Watcher` 被计算，另外它的自身属性 `subs` 是 `Watcher` 的数组。

`Dep` 实际上就是对 `Watcher` 的一种管理，`Dep` 脱离 `Watcher` 单独存在是没有意义的。

```javascript
class Dep {
  static target;
  constructor () {
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
```

#### Watcher

```javascript
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
  get() {
    // 这里 Dep.target 指向 watcher 本身，然后会取值，取值触发对应属性的 getter 方法。
    // 此时 getter 方法里面使用的 Dep.target 就有值了。
    // 通过一系列的代码执行 dep.depend() -> Dep.target.addDep(dep) -> dep.addSub(watcher) 
    // 最后把 watcher 存到 subs 数组里，完成依赖收集。
    // 最后把 Dep.target 删除，保证来 Dep.target 在同一时间内只有唯一一个。
    Dep.target = this;
    const vm = this.vm
    let value = this.getter.call(vm, vm)
    Dep.target = null;
    return value
  }
  addDep(dep) {
    if (!this.depIds.hasOwnProperty(dep.id)) {
      dep.addSub(this);
      this.depIds[dep.id] = dep;
    }
  }
  update() {
    // this.value 是 watcher 缓存的值，用来与改变后的值进行对比，如果前后值没有变化，就不进行更新。
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
```



### 三、过程分析

1. `new MVVM()` 的时候，首先，会对 `data`、`props` 、`computed` 进行初始化，使它们变成响应式的对象。
2. 响应式是通过使用 `Object.defineProperty` 给对象的属性设置 `get`、`set`，为属性提供 getter、setter 方法，一旦对象拥有了 getter 和 setter，我们可以简单地把这个对象称为响应式对象。。
3. 当我们访问了该属性的时候会触发 getter 方法，当我们对该属性做修改的时候会触发 setter 方法。
4. 在 getter 方法里做依赖的收集。因为在使用属性的时候，就会触发 getter，这时就会把这个使用记录起来，后面属性有改动的时候，就会根据这个收集的记录进行更新。
5. 在 setter 方法里做派发更新。因为在对属性做修改的时候会触发这个setter，这时就可以根据之前在 getter 里面收集的记录，去做对应的更新。
6. getter 的实现中，是通过 `Dep` 实现依赖收集的。getter 方法中调用了 `Dep.depend()` 进行收集，`Dep.depend()` 中又调用了 `Dep.target.addDep(this) ` 。
7. 这里 `Dep.target` 是个非常巧妙的设计，因为在同一时间 `Dep.target` 只指向一个 `Watcher`，使得同一时间内只能有一个全局的 `Watcher` 被计算。
8. `Dep.target.addDep(this)` 等于调用 `Watcher.addDep(dep)` ，里面又调用了 `dep.addSub(this)` 把这个全局唯一的 watcher 添加到 `dep.subs` 数组中，收集了起来，并且 watcher 本身也通过 `depIds` 收集持有的 `Dep` 实例。
9. 上面只是定义了一个流程，但是需要访问数据对象才能触发 getter 使这个流程运转起来。那什么时候触发呢？
10. Vue 会通过 `compile` 把模版编译成 `render` 函数，并在 `render` 函数中访问数据对象触发 getter。这里我们是直接在 `compile` 的时候访问数据对象触发 getter。
11. `compile` 负责内容的渲染与数据更新。`compile` 编译模版中的内容，把模版中的 {{xx}} 字符串替换成对应的属性值时会访问数据对象触发 getter，不过此时还没有 `watcher`，没有依赖收集。
12. `compile` 接下来会实例化 `Watcher`，实例化过程会再去取一次值，此时触发到 getter 才会进行依赖收集。具体看 `Watcher` 的 构造函数与 get 方法实现。
13. 到这里，页面渲染完成，依赖收集也完成。
14. 接下来会监控数据的变化，数据如果发生变化，就会触发属性值的 setter 方法，setter 方法除了把值设置为新的值之外，还会进行派发更新。执行 `dep.notify()`，循环调用 `subs` 里面保存的 `watcher` 的 `update` 方法进行更新。

