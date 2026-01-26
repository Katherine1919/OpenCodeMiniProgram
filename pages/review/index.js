const store = require('../../utils/store');

Page({
  data: {
    stats: {
      completionRate: 0,
      totalMinutes: 0,
      availableMinutes: 0
    },
    notDoneReasons: [],
    statusBarHeight: 0,
    headerHeight: 0
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      headerHeight: systemInfo.statusBarHeight + 44
    });
    this.loadData();
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
  },

  onShow() {
    this.loadData();
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().updateSelected();
    }
  },

  loadData() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const scheduleItems = store.getSchedule(dateStr);
    const templates = store.getTimeTemplates();
    const tasks = store.getTasks();

    // 用 task 表兜底同步 status 和 minutes，确保与今日页数据一致
    const taskItems = scheduleItems
      .filter(it => it.kind === 'task')
      .map(it => {
        const t = tasks.find(tk => tk.id === it.taskId);
        return {
          ...it,
          status: it.status || (t ? t.status : 'todo'),
          minutes: it.minutes || (t ? t.minutes : 0)
        };
      });

    const doneCount = taskItems.filter(it => it.status === 'done').length;
    const totalMinutes = taskItems.filter(it => it.status === 'done').reduce((sum, it) => sum + (it.minutes || 0), 0);
    const availableMinutes = templates.reduce((sum, tmpl) => {
      const [sh, sm] = tmpl.start.split(':').map(Number);
      const [eh, em] = tmpl.end.split(':').map(Number);
      return sum + ((eh * 60 + em) - (sh * 60 + sm));
    }, 0);

    const completionRate = taskItems.length > 0 ? Math.round((doneCount / taskItems.length) * 100) : 0;

    // 同样用 task 表兜底获取未完成原因
    const notDoneItems = taskItems.filter(it => it.status === 'not_done' && it.note);
    const notDoneReasons = notDoneItems.map(it => ({
      title: it.title,
      reason: it.note
    }));

    this.setData({
      stats: { completionRate, totalMinutes, availableMinutes },
      notDoneReasons
    });
  },

  exportCSV() {
    wx.showToast({ title: '导出功能开发中', icon: 'none', duration: 2000 });
  }
});
