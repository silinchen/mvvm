/**
 * 这里到 Compile 只是简单到模版编译
 * 与 Vue 实际Compile 有较大区别，实际的 Compile 实现比较复杂，
 * 需要经过 parse、optimize、generate 三个阶段处理
 * parse: 使用正则解析template中的vue的指令(v-xxx) 变量等等 形成抽象语法树AST
 * optimize: 标记一些静态节点，用作后面的性能优化，在diff的时候直接略过
 * generate: 把第一部生成的AST 转化为渲染函数 render function
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

    Array.from(childNodes).forEach(node => {
      const text = node.textContent;

      if (this.isElementNode(node)) {
        this.compileElement(node);
      } else if (this.isTextNode(node) && /\{\{(.*)\}\}/.test(text)) {
        this.compileText(node, RegExp.$1.trim());
      }

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

// 指令处理集合
var compileUtil = {
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
    const updaterFn = updater[dir + 'Updater'];
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

var updater = {
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