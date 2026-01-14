const store = require('../../utils/store');
const { generateSchedule, timeToMinutes } = require('../../utils/scheduler');
const { normalizeTimeInput } = require('../../utils/time');

Page({
  data: {
    templates: [],
    schedulePreview: [],
    showAddForm: false,
    editingId: null,
    rawFormStart: '',
    rawFormEnd: '',
    formLabel: '',
    statusBarHeight: 0,
    headerHeight: 0
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync();
    const menuButton = wx.getMenuButtonBoundingClientRect();
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      headerHeight: systemInfo.statusBarHeight + 44
    });
    this.loadTemplates();
    this.loadPreview();
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
  },

  onShow() {
    this.loadTemplates();
    this.loadPreview();
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().updateSelected();
    }
  },

  loadTemplates() {
    const templates = store.getTimeTemplates();
    this.setData({ templates });
  },

  loadPreview() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    let dayState = store.getDayState(dateStr);
    
    if (dayState && dayState.scheduleItems) {
      const currentTasks = store.getTasks();
      const currentTaskIds = currentTasks.map(t => t.id);
      
      const filteredItems = dayState.scheduleItems.filter(item => {
        if (!item.taskId) return true;
        return currentTaskIds.includes(item.taskId);
      });
      
      if (filteredItems.length !== dayState.scheduleItems.length) {
        dayState.scheduleItems = filteredItems;
        store.saveDayState(dateStr, dayState);
      }
      
      this.setData({ schedulePreview: filteredItems });
    } else {
      this.setData({ schedulePreview: [] });
    }
  },

  showAdd() {
    this.setData({ 
      showAddForm: true, 
      editingId: null,
      rawFormStart: '', 
      rawFormEnd: '', 
      formLabel: '' 
    });
  },

  editTemplate(e) {
    const { id } = e.currentTarget.dataset;
    const tmpl = this.data.templates.find(t => t.id === id);
    if (tmpl) {
      this.setData({ 
        showAddForm: true, 
        editingId: id,
        rawFormStart: tmpl.start, 
        rawFormEnd: tmpl.end, 
        formLabel: tmpl.label || '' 
      });
    }
  },

  deleteTemplate(e) {
    const { id } = e.currentTarget.dataset;
    wx.showModal({
      title: '确认删除',
      content: '确定删除此时间模板？',
      confirmText: '删除',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          store.deleteTimeTemplate(id);
          this.loadTemplates();
          wx.showToast({ title: '已删除', icon: 'success' });
        }
      }
    });
  },

  onStartInput(e) {
    this.setData({ rawFormStart: e.detail.value });
  },

  onEndInput(e) {
    this.setData({ rawFormEnd: e.detail.value });
  },

  onLabelInput(e) {
    this.setData({ formLabel: e.detail.value });
  },

  cancelAdd() {
    this.setData({ showAddForm: false });
  },

  saveTemplate() {
    const { rawFormStart, rawFormEnd, formLabel, editingId } = this.data;
    
    const normalizedStart = normalizeTimeInput(rawFormStart);
    const normalizedEnd = normalizeTimeInput(rawFormEnd);
    
    if (!normalizedStart || !normalizedEnd) {
      wx.showToast({ title: '时间格式不正确', icon: 'none' });
      return;
    }
    
    if (timeToMinutes(normalizedEnd) <= timeToMinutes(normalizedStart)) {
      wx.showToast({ title: '结束时间要晚于开始时间', icon: 'none' });
      return;
    }
    
    if (editingId) {
      store.updateTimeTemplate(editingId, { 
        start: normalizedStart, 
        end: normalizedEnd, 
        label: formLabel 
      });
      wx.showToast({ title: '已更新', icon: 'success' });
    } else {
      store.addTimeTemplate({ 
        start: normalizedStart, 
        end: normalizedEnd, 
        label: formLabel || '可用时间' 
      });
      wx.showToast({ title: '已添加', icon: 'success' });
    }
    
    this.setData({ showAddForm: false });
    this.loadTemplates();
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
    
    this.loadPreview();
    
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
  }
});
