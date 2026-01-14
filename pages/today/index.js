const store = require('../../utils/store');
const { timeToMinutes, minutesToTime } = require('../../utils/scheduler');

Page({
  data: {
    dateDisplay: '',
    completionRate: 0,
    totalMinutes: 0,
    nextTaskTitle: '',
    scheduleItems: [],
    expandedReasonId: null,
    reasonInput: ''
  },

  onLoad() {
    this.loadData();
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
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
    const dateDisplay = `${today.getMonth() + 1}月${today.getDate()}日`;
    const dateStr = today.toISOString().split('T')[0];
    
    const scheduleItems = store.getSchedule(dateStr);
    const tasks = store.getTasks();
    
    const taskItems = scheduleItems.filter(it => it.kind === 'task');
    const doneCount = taskItems.filter(it => it.status === 'done').length;
    const completionRate = taskItems.length > 0 ? Math.round((doneCount / taskItems.length) * 100) : 0;
    
    const totalMinutes = taskItems.reduce((sum, it) => sum + it.minutes, 0);
    
    const nowMinutes = today.getHours() * 60 + today.getMinutes();
    const nextTask = taskItems.find(it => 
      it.status !== 'done' && 
      it.status !== 'not_done' && 
      timeToMinutes(it.start) >= nowMinutes
    );
    
    const enrichedItems = scheduleItems.map(it => {
      if (it.kind === 'task') {
        const task = tasks.find(t => t.id === it.taskId);
        return { 
          ...it, 
          category: task?.category || '',
          showReason: it.status === 'not_done' && it.note
        };
      }
      return it;
    });
    
    this.setData({
      dateDisplay,
      completionRate,
      totalMinutes,
      nextTaskTitle: nextTask?.title || '',
      scheduleItems: enrichedItems
    });
    
    this.drawProgressRing();
  },

  drawProgressRing() {
    setTimeout(() => {
      const query = wx.createSelectorQuery().in(this);
      query.select('#progressCanvas').fields({ node: true, size: true }).exec((res) => {
        if (res[0]) {
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const dpr = wx.getSystemInfoSync().pixelRatio;
          
          const size = 200;
          canvas.width = size * dpr;
          canvas.height = size * dpr;
          ctx.scale(dpr, dpr);
          
          const centerX = size / 2;
          const centerY = size / 2;
          const radius = 70;
          
          ctx.clearRect(0, 0, size, size);
          ctx.lineWidth = 12;
          ctx.lineCap = 'round';
          
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
          ctx.strokeStyle = 'rgba(61, 53, 48, 0.08)';
          ctx.stroke();
          
          const progress = this.data.completionRate / 100;
          const startAngle = -Math.PI / 2;
          const endAngle = startAngle + progress * 2 * Math.PI;
          
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, startAngle, endAngle);
          ctx.strokeStyle = '#F7C86A';
          ctx.stroke();
        }
      });
    }, 100);
  },

  completeTask(e) {
    const { id, taskid } = e.currentTarget.dataset;
    const dateStr = new Date().toISOString().split('T')[0];
    
    store.updateTask(taskid, { status: 'done' });
    
    const scheduleItems = store.getSchedule(dateStr);
    const updated = scheduleItems.map(it => 
      it.id === id ? { ...it, status: 'done' } : it
    );
    store.saveSchedule(dateStr, updated);
    
    this.loadData();
    wx.showToast({ title: '已完成', icon: 'success', duration: 1500 });
  },

  skipTask(e) {
    const { id } = e.currentTarget.dataset;
    this.setData({ expandedReasonId: id, reasonInput: '' });
  },

  onReasonInput(e) {
    this.setData({ reasonInput: e.detail.value });
  },

  saveReason(e) {
    const { id, taskid } = e.currentTarget.dataset;
    const { reasonInput } = this.data;
    const dateStr = new Date().toISOString().split('T')[0];
    
    store.updateTask(taskid, { status: 'overflow' });
    
    const scheduleItems = store.getSchedule(dateStr);
    const updated = scheduleItems.map(it => 
      it.id === id ? { ...it, status: 'not_done', note: reasonInput } : it
    );
    store.saveSchedule(dateStr, updated);
    
    this.setData({ expandedReasonId: null });
    this.loadData();
    wx.showToast({ title: '已记下', icon: 'success', duration: 1500 });
  }
});
