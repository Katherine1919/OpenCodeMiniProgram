const store = require('../../utils/store');
const { normalizeTimeInput, validateTimeRange } = require('../../utils/time');
const { timeToMinutes } = require('../../utils/scheduler');

Page({
  data: {
    newTask: {
      title: '',
      category: '工作',
      minutes: 30,
      ddl: '',
      priority: 'high',
      isFixed: false,
      startTime: '',
      endTime: '',
      repeatRule: null
    },
    rawStartTime: '',
    rawEndTime: '',
    selectedMinutes: 30,
    customMinutes: '',
    filterTab: 'today',
    tasks: [],
    filteredTasks: []
  },

  onLoad() {
    this.loadTasks();
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
  },

  onShow() {
    this.loadTasks();
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().updateSelected();
    }
  },

  loadTasks() {
    const tasks = store.getTasks();
    this.setData({ tasks });
    this.filterTasks();
  },

  filterTasks() {
    const { filterTab, tasks } = this.data;
    let filtered = [];
    
    switch (filterTab) {
      case 'today':
        filtered = tasks.filter(t => t.status === 'todo' || t.status === 'scheduled' || t.status === 'overflow');
        break;
      case 'scheduled':
        filtered = tasks.filter(t => t.status === 'scheduled');
        break;
      case 'done':
        filtered = tasks.filter(t => t.status === 'done');
        break;
      case 'not_done':
        filtered = tasks.filter(t => t.status === 'not_done');
        break;
      case 'overflow':
        filtered = tasks.filter(t => t.status === 'overflow');
        break;
    }
    
    this.setData({ filteredTasks: filtered });
  },

  onTitleInput(e) {
    this.setData({ 'newTask.title': e.detail.value });
  },

  selectCategory(e) {
    const category = e.currentTarget.dataset.cat;
    this.setData({ 'newTask.category': category });
  },

  selectMinutes(e) {
    const minutes = parseInt(e.currentTarget.dataset.min);
    this.setData({ 
      selectedMinutes: minutes,
      'newTask.minutes': minutes,
      customMinutes: ''
    });
  },

  onCustomMinutesInput(e) {
    let val = parseInt(e.detail.value) || 0;
    if (val < 5) val = 5;
    if (val > 480) val = 480;
    this.setData({ 
      customMinutes: e.detail.value,
      'newTask.minutes': val,
      selectedMinutes: 'custom'
    });
  },

  onDdlChange(e) {
    this.setData({ 'newTask.ddl': e.detail.value });
  },

  selectPriority(e) {
    const priority = e.currentTarget.dataset.pri;
    this.setData({ 'newTask.priority': priority });
  },

  toggleFixed(e) {
    this.setData({ 'newTask.isFixed': e.detail.value });
  },

  onStartTimeInput(e) {
    this.setData({ rawStartTime: e.detail.value });
  },

  onStartTimeBlur() {
    const normalized = normalizeTimeInput(this.data.rawStartTime);
    if (normalized) {
      this.setData({ 'newTask.startTime': normalized });
      
      const currentMinutes = this.data.newTask.minutes;
      if (currentMinutes > 0) {
        const startMins = timeToMinutes(normalized);
        const endMins = startMins + currentMinutes;
        
        if (endMins < 1440) {
          const eh = Math.floor(endMins / 60);
          const em = endMins % 60;
          const autoEnd = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
          this.setData({ 
            'newTask.endTime': autoEnd,
            rawEndTime: autoEnd
          });
        }
      }
    } else if (this.data.rawStartTime.trim()) {
      wx.showToast({ title: '时间格式不正确', icon: 'none', duration: 1500 });
    }
  },

  onEndTimeInput(e) {
    this.setData({ rawEndTime: e.detail.value });
  },

  onEndTimeBlur() {
    const normalized = normalizeTimeInput(this.data.rawEndTime);
    if (normalized) {
      this.setData({ 'newTask.endTime': normalized });
      
      const startTime = this.data.newTask.startTime;
      if (startTime) {
        const startMins = timeToMinutes(startTime);
        const endMins = timeToMinutes(normalized);
        const calculatedMinutes = endMins - startMins;
        
        if (calculatedMinutes > 0) {
          this.setData({ 'newTask.minutes': calculatedMinutes });
        }
      }
    } else if (this.data.rawEndTime.trim()) {
      wx.showToast({ title: '时间格式不正确', icon: 'none', duration: 1500 });
    }
  },

  selectRepeat(e) {
    const rule = e.currentTarget.dataset.rule;
    this.setData({ 'newTask.repeatRule': rule === 'null' ? null : rule });
  },

  addTask() {
    const { newTask } = this.data;
    
    if (!newTask.title.trim()) {
      wx.showToast({ title: '请输入任务标题', icon: 'none' });
      return;
    }
    
    if (newTask.isFixed) {
      const normalizedStart = normalizeTimeInput(this.data.rawStartTime || newTask.startTime);
      const normalizedEnd = normalizeTimeInput(this.data.rawEndTime || newTask.endTime);
      
      if (!normalizedStart) {
        wx.showToast({ title: '请输入有效的开始时间', icon: 'none', duration: 2000 });
        return;
      }
      
      if (!normalizedEnd) {
        wx.showToast({ title: '请输入有效的结束时间', icon: 'none', duration: 2000 });
        return;
      }
      
      if (!validateTimeRange(normalizedStart, normalizedEnd)) {
        wx.showToast({ title: '结束时间必须晚于开始时间', icon: 'none' });
        return;
      }
      
      const taskData = {
        title: newTask.title.trim(),
        category: newTask.category,
        priority: newTask.priority,
        ddl: newTask.ddl || null,
        isFixed: true,
        startTime: normalizedStart,
        endTime: normalizedEnd,
        repeatRule: newTask.repeatRule
      };
      
      const result = store.addTask(taskData);
      
      if (!result) {
        wx.showToast({ title: '时间范围不合法，请检查', icon: 'none', duration: 2000 });
        return;
      }
    } else {
      const taskData = {
        title: newTask.title.trim(),
        category: newTask.category,
        minutes: newTask.minutes,
        ddl: newTask.ddl || null,
        priority: newTask.priority,
        isFixed: false
      };
      
      store.addTask(taskData);
    }
    
    this.setData({
      newTask: {
        title: '',
        category: '工作',
        minutes: 30,
        ddl: '',
        priority: 'high',
        isFixed: false,
        startTime: '',
        endTime: '',
        repeatRule: null
      },
      rawStartTime: '',
      rawEndTime: '',
      selectedMinutes: 30,
      customMinutes: ''
    });
    
    this.loadTasks();
    wx.showToast({ title: '已加入任务池', icon: 'success' });
  },

  selectFilter(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ filterTab: tab });
    this.filterTasks();
  },

  deleteTask(e) {
    const { id } = e.currentTarget.dataset;
    wx.showModal({
      title: '确认删除',
      content: '确定删除此任务？',
      confirmText: '删除',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          store.deleteTask(id);
          this.loadTasks();
          wx.showToast({ title: '已删除', icon: 'success' });
        }
      }
    });
  }
});
