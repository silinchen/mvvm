/**
 * 这里的 Compile 只是简单的模版编译
 * 与 Vue 实际Compile 有较大区别，实际的 Compile 实现比较复杂，
 * 需要经过 parse、optimize、generate 三个阶段处理
 * parse: 使用正则解析template中的vue的指令(v-xxx) 变量等等 形成抽象语法树AST
 * optimize: 标记一些静态节点，用作后面的性能优化，在diff的时候直接略过
 * generate: 把第一部生成的AST 转化为渲染函数 render function
 * 
 * 这里 Compile 负责数据的渲染与更新。
 */
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

  compileText: function (node, exp, text) {
    // compileUtil.text(node, this.$vm, exp);
    const vm = this.$vm
    // 文本更新的方法
    const updaterFn = updater.textUpdater
    // 替换 text 中的 {{xx}} 字符串.
    // 这里的 text 是通过闭包的机制，保存了最原始的模版字符串，例如：message is :{{message}}。后续更新都会根据这个字符串去替换其中的模版内容。
    const value = text.replace(/\{\{(.*)\}\}/, compileUtil._getVMVal(vm, exp))
    // 将替换后的值传给更新函数更新
    updaterFn && updaterFn(node, value);

    // 实例化 Watcher 触发依赖收集。
    // vm, exp 参数，用来取属性值 vm[exp]
    // 第三个参数是回调函数，会在派发更新的时候被触发更新文本内容。
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

// 指令处理集合
const compileUtil = {
  text: function (node, vm, exp) {
    this.update(node, vm, exp, 'text');
  },

  html: function (node, vm, exp) {
    this.update(node, vm, exp, 'html');
  },

  model: function (node, vm, exp) {
    this.update(node, vm, exp, 'model');

    let val = this._getVMVal(vm, exp);
    node.addEventListener('input', e => {
      const newValue = e.target.value;
      if (val === newValue) {
        return;
      }

      this._setVMVal(vm, exp, newValue);
      val = newValue;
    });
  },

  class: function (node, vm, exp) {
    this.update(node, vm, exp, 'class');
  },

  update: function (node, vm, exp, dir) {
    // 针对不同的指令使用不同的函数渲染、更新数据。
    const updaterFn = updater[dir + 'Updater'];
    // 这里取值，然后进行初次的内容渲染
    updaterFn && updaterFn(node, this._getVMVal(vm, exp));
    new Watcher(vm, exp, function (value, oldValue) {
      updaterFn && updaterFn(node, value, oldValue);
    });
  },

  // 事件处理
  eventHandler: function (node, vm, exp, dir) {
    const eventType = dir.split(':')[1],
      fn = vm.$options.methods && vm.$options.methods[exp];

    if (eventType && fn) {
      node.addEventListener(eventType, fn.bind(vm), false);
    }
  },

  _getVMVal: function (vm, exp) {
    let val = vm;
    exp = exp.split('.');
    exp.forEach(function (k) {
      val = val[k];
    });
    return val;
  },

  _setVMVal: function (vm, exp, value) {
    let val = vm;
    exp = exp.split('.');
    exp.forEach(function (k, i) {
      // 非最后一个key，更新val的值
      if (i < exp.length - 1) {
        val = val[k];
      } else {
        val[k] = value;
      }
    });
  }
};

const updater = {
  textUpdater: function (node, value) {
    node.textContent = typeof value == 'undefined' ? '' : value;
  },

  htmlUpdater: function (node, value) {
    node.innerHTML = typeof value == 'undefined' ? '' : value;
  },

  classUpdater: function (node, value, oldValue) {
    const className = node.className;
    className = className.replace(oldValue, '').replace(/\s$/, '');

    const space = className && String(value) ? ' ' : '';

    node.className = className + space + value;
  },

  modelUpdater: function (node, value) {
    node.value = typeof value == 'undefined' ? '' : value;
  }
};