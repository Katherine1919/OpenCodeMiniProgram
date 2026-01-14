const store = require('../../utils/store');
const { normalizeTimeInput, validateTimeRange } = require('../../utils/time');
const { timeToMinutes, generateSchedule } = require('../../utils/scheduler');

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
    filteredTasks: [],
    statusBarHeight: 0,
    headerHeight: 0,
    editingTaskId: null
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      headerHeight: systemInfo.statusBarHeight + 44
    });
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
    const { newTask, editingTaskId } = this.data;
    
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
      
      if (editingTaskId) {
        const result = store.updateTask(editingTaskId, taskData);
        if (!result) {
          wx.showToast({ title: '时间范围不合法，请检查', icon: 'none', duration: 2000 });
          return;
        }
      } else {
        const result = store.addTask(taskData);
        if (!result) {
          wx.showToast({ title: '时间范围不合法，请检查', icon: 'none', duration: 2000 });
          return;
        }
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
      
      if (editingTaskId) {
        store.updateTask(editingTaskId, taskData);
      } else {
        store.addTask(taskData);
      }
    }
    
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    store.saveDayState(dateStr, { date: dateStr, scheduleItems: [], notDoneReasons: [] });
    
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
      customMinutes: '',
      editingTaskId: null
    });
    
    this.loadTasks();
    wx.showToast({ title: editingTaskId ? '已保存，请重新生成排程' : '已加入任务池', icon: editingTaskId ? 'none' : 'success', duration: 2000 });
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
      content: '确定删除此任务？删除后今日排程需重新生成。',
      confirmText: '删除',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          store.deleteTask(id);
          
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const day = String(today.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;
          store.saveDayState(dateStr, { date: dateStr, scheduleItems: [], notDoneReasons: [] });
          
          this.loadTasks();
          wx.showToast({ title: '已删除，请重新生成排程', icon: 'none', duration: 2000 });
        }
      }
    });
  },

  editTask(e) {
    const { id } = e.currentTarget.dataset;
    const task = this.data.tasks.find(t => t.id === id);
    if (!task) return;
    
    this.setData({
      newTask: {
        title: task.title,
        category: task.category,
        minutes: task.minutes || 30,
        ddl: task.ddl || '',
        priority: task.priority,
        isFixed: task.isFixed || false,
        startTime: task.startTime || '',
        endTime: task.endTime || '',
        repeatRule: task.repeatRule || null
      },
      rawStartTime: task.startTime || '',
      rawEndTime: task.endTime || '',
      selectedMinutes: task.minutes || 30,
      customMinutes: '',
      editingTaskId: id
    });
    
    const scrollTop = 0;
    wx.pageScrollTo({
      scrollTop: scrollTop,
      duration: 300
    });
  },

  generateToday() {
    const templates = store.getTimeTemplates();
    if (templates.length === 0) {
      wx.showToast({ title: '请先添加时间模板', icon: 'none', duration: 2000 });
      return;
    }
    
    const tasks = store.getTasks();
    
    const fixedCandidates = tasks.filter(t => t.isFixed && t.status !== 'done');
    const flexibleCandidates = tasks.filter(t => 
      !t.isFixed && (t.status === 'todo' || t.status === 'scheduled' || t.status === 'overflow')
    );
    
    const candidatesMap = new Map();
    fixedCandidates.forEach(t => candidatesMap.set(t.id, t));
    flexibleCandidates.forEach(t => candidatesMap.set(t.id, t));
    const candidates = Array.from(candidatesMap.values());
    
    if (candidates.length === 0) {
      wx.showToast({ title: '暂无待排任务', icon: 'none', duration: 2000 });
      return;
    }
    
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    // Clear old cache BEFORE generating new schedule
    store.saveDayState(dateStr, { date: dateStr, scheduleItems: [], notDoneReasons: [] });
    
    const result = generateSchedule(candidates, templates, dateStr);
    const { 
      scheduleItems, 
      conflictFixedTaskIds,
      overflowTaskIds
    } = result;
    
    const dayState = {
      date: dateStr,
      scheduleItems,
      notDoneReasons: []
    };
    store.saveDayState(dateStr, dayState);
    
    const allTasks = store.getTasks();
    const updatedTasks = allTasks.map(t => {
      const scheduled = scheduleItems.find(it => it.taskId === t.id);
      if (scheduled) return { ...t, status: 'scheduled' };
      if (overflowTaskIds.includes(t.id)) return { ...t, status: 'overflow' };
      return t;
    });
    store.saveTasks(updatedTasks);
    
    this.loadTasks();
    
    // Filter conflict IDs to only include tasks that still exist
    const currentTaskIds = tasks.map(t => t.id);
    const actualConflicts = conflictFixedTaskIds.filter(id => currentTaskIds.includes(id));
    
    const warnings = [];
    if (actualConflicts.length > 0) warnings.push(`${actualConflicts.length}个固定任务时间冲突`);
    if (overflowTaskIds.length > 0) warnings.push(`${overflowTaskIds.length}个任务超出可用时间`);
    
    if (warnings.length > 0) {
      wx.showToast({ title: '排程已生成，' + warnings.join('，'), icon: 'none', duration: 3000 });
    } else {
      wx.showToast({ title: '排程已生成', icon: 'success', duration: 2000 });
    }
    
    // Navigate to schedule page after generation
    setTimeout(() => {
      wx.switchTab({
        url: '/pages/schedule/index'
      });
    }, 2000);
  }
});
