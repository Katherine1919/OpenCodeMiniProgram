Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/today/index', text: '今日' },
      { pagePath: '/pages/schedule/index', text: '排程' },
      { pagePath: '/pages/tasks/index', text: '任务' },
      { pagePath: '/pages/review/index', text: '复盘' }
    ]
  },

  methods: {
    switchTab(e) {
      const index = e.currentTarget.dataset.index;
      wx.switchTab({ url: this.data.list[index].pagePath });
      this.setData({ selected: index });
    },

    updateSelected() {
      const pages = getCurrentPages();
      const currentPage = pages[pages.length - 1];
      const route = '/' + currentPage.route;
      const index = this.data.list.findIndex(item => item.pagePath === route);
      if (index !== -1) this.setData({ selected: index });
    }
  }
});
