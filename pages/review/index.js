const store = require('../../utils/store');

Page({
  data: {
    stats: {
      completionRate: 0,
      totalMinutes: 0,
      availableMinutes: 0
    },
    notDoneReasons: []
  },

  onLoad() {
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
    const dateStr = new Date().toISOString().split('T')[0];
    const scheduleItems = store.getSchedule(dateStr);
    const templates = store.getTemplates();
    
    const taskItems = scheduleItems.filter(it => it.kind === 'task');
    const doneCount = taskItems.filter(it => it.status === 'done').length;
    const totalMinutes = taskItems.reduce((sum, it) => sum + it.minutes, 0);
    const availableMinutes = templates.reduce((sum, tmpl) => {
      const [sh, sm] = tmpl.start.split(':').map(Number);
      const [eh, em] = tmpl.end.split(':').map(Number);
      return sum + ((eh * 60 + em) - (sh * 60 + sm));
    }, 0);
    
    const completionRate = taskItems.length > 0 ? Math.round((doneCount / taskItems.length) * 100) : 0;
    
    const notDoneItems = scheduleItems.filter(it => it.kind === 'task' && it.status === 'not_done' && it.note);
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
