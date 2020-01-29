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

    Array.from(childNodes).forEach(node => {
      const text = node.textContent;
			// 元素节点
      if (this.isElementNode(node)) {
        this.compileElement(node);
      }
      // 文本节点，并且有 {{}} 模版字符串
      else if (this.isTextNode(node) && /\{\{(.*)\}\}/.test(text)) {
        this.compileText(node, RegExp.$1.trim());
      }
			// 递归编译元素子节点
      if (node.childNodes && node.childNodes.length) {
        this.compile(node);
      }
    });
  },

  compileElement: function (node) {
    const nodeAttrs = node.attributes

    Array.from(nodeAttrs).forEach(attr => {
      const attrName = attr.name;
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
    const updaterFn = updater[dir + 'Updater'];
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

把每一个值 `vm._data.xxx` 都代理到 `vm.xxx` 上

````javascript
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
function defineReactive (obj, key, val) {
	// 初始化 Dep，用于依赖收集
  const dep = new Dep()

  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  const getter = property && property.get
  const setter = property && property.set
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }

	// 对子对象递归调用 observe 方法，这样就保证了无论 obj 的结构多复杂，它的所有子属性也能变成响应式的对象，这样我们访问或修改 obj 中一个嵌套较深的属性，也能触发 getter 和 setter
  let childOb = observe(val)
  // Object.defineProperty 去给 obj 的属性 key 添加 getter 和 setter
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      const value = getter ? getter.call(obj) : val
      if (Dep.target) {
        // 依赖收集
        dep.depend()
        if (childOb) {
          childOb.dep.depend()
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      const value = getter ? getter.call(obj) : val
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      // #7981: for accessor properties without setter
      if (getter && !setter) return
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      childOb = observe(newVal)
      // 派发更新
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
    // 存放 watcher
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
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
    } else {
      this.getter = parsePath(expOrFn) || function noop (a, b, c) {}
    }
    this.value = this.get()
  }
  get() {
    Dep.target = this;
    const vm = this.vm
    // 这里的 getter 是
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
  // 在派发更新的时候会调用这个
  update() {
    this.run()
  }
  // 
  run() {
    const value = this.get()
    const oldValue = this.value
    if (value !== oldValue) {
      this.value = value
      this.cb.call(this.vm, value, oldValue)
    }
  }
}
```








