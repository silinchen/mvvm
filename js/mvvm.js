function MVVM(options) {
    var vm = this;
    vm.$options = options || {};
    vm._data = vm.$options.data;
    /**
     * initState 主要对数据对处理
     * 实现 observe，即对 data／computed 等做响应式处理以及将数据代理到 vm 实例上
     */
    initState(vm)

    this.$compile = new Compile(options.el || document.body, this)
}
