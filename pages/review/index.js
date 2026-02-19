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

    const taskItems = scheduleItems.filter(it => it.kind === 'task');
    const doneCount = taskItems.filter(it => it.status === 'done').length;
    const totalMinutes = taskItems.filter(it => it.status === 'done').reduce((sum, it) => sum + it.minutes, 0);
    const availableMinutes = templates.reduce((sum, tmpl) => {
      // 添加时间格式验证
      if (!tmpl.start || !tmpl.end) return sum;
      const [sh, sm] = tmpl.start.split(':').map(Number);
      const [eh, em] = tmpl.end.split(':').map(Number);
      if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return sum;
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
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const scheduleItems = store.getSchedule(dateStr);
    const tasks = store.getTasks();
    
    let csvContent = '\uFEFF'; // BOM for UTF-8
    csvContent += '标题,类型,状态,开始时间,结束时间,时长(分钟),分类\n';
    
    scheduleItems.forEach(item => {
      if (item.kind === 'task') {
        const task = tasks.find(t => t.id === item.taskId);
        const category = task ? task.category : '';
        csvContent += `${item.title || ''},任务,${item.status || ''},${item.start || ''},${item.end || ''},${item.minutes || 0},${category}\n`;
      } else {
        csvContent += `休息,休息,,-,-,0,\n`;
      }
    });

    const fileName = `schedule_${dateStr}.csv`;
    
    // 使用微信文件系统保存
    const fs = wx.getFileSystemManager();
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
    
    try {
      fs.writeFileSync(filePath, csvContent, 'utf8');
      
      wx.shareFileMessage({
        filePath: filePath,
        fileName: fileName,
        success: () => {
          wx.showToast({ title: '导出成功', icon: 'success' });
        },
        fail: (err) => {
          console.error('分享失败:', err);
          // 如果分享失败，尝试打开文件
          wx.openDocument({
            filePath: filePath,
            fileType: 'csv',
            success: () => {
              wx.showToast({ title: '已打开文件', icon: 'success' });
            },
            fail: () => {
              wx.showToast({ title: '导出失败', icon: 'none' });
            }
          });
        }
      });
    } catch (error) {
      console.error('写入文件失败:', error);
      wx.showToast({ title: '导出失败', icon: 'none' });
    }
  }
});
