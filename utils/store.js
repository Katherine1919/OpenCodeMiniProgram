const STORAGE_KEYS = {
  TASKS: 'ocp_tasks',
  DAY_STATES: 'ocp_day_states',
  TIME_TEMPLATES: 'ocp_time_templates'
};

const { timeToMinutes, minutesToTime } = require('./scheduler');

class Store {
  getTasks() {
    const tasks = wx.getStorageSync(STORAGE_KEYS.TASKS) || [];
    
    return tasks.map(t => {
      const priority = t.priority === 'medium' ? 'mid' : (t.priority || 'mid');
      
      let minutes = t.minutes;
      if (!minutes && t.fixedMinutes) {
        minutes = t.fixedMinutes;
      }
      if (!minutes && t.durationMin) {
        minutes = t.durationMin;
      }
      if (!minutes) {
        minutes = 30;
      }
      
      return {
        ...t,
        priority,
        minutes,
        isFixed: t.isFixed || t.fixed || false,
        startTime: t.startTime || t.fixedStartTime || null,
        endTime: t.endTime || t.fixedEndTime || null,
        repeatRule: t.repeatRule || t.fixedRepeat || null,
        status: t.status || 'todo',
        createdAt: t.createdAt || new Date().toISOString()
      };
    });
  }

  saveTasks(tasks) {
    wx.setStorageSync(STORAGE_KEYS.TASKS, tasks);
  }

  getDayStates() {
    return wx.getStorageSync(STORAGE_KEYS.DAY_STATES) || {};
  }

  saveDayStates(dayStates) {
    wx.setStorageSync(STORAGE_KEYS.DAY_STATES, dayStates);
  }

  getDayState(dateStr) {
    const states = this.getDayStates();
    return states[dateStr] || null;
  }

  saveDayState(dateStr, dayState) {
    const states = this.getDayStates();
    states[dateStr] = dayState;
    this.saveDayStates(states);
  }

  getSchedule(dateStr) {
    const dayState = this.getDayState(dateStr);
    if (!dayState || !dayState.scheduleItems) {
      return [];
    }
    
    // Self-healing: filter out items for non-existent tasks
    const currentTasks = this.getTasks();
    const currentTaskIds = currentTasks.map(t => t.id);
    
    const filteredItems = dayState.scheduleItems.filter(item => {
      if (!item.taskId) return true; // Keep non-task items (breaks, etc.)
      return currentTaskIds.includes(item.taskId);
    });
    
    // Auto-save if we filtered anything out
    if (filteredItems.length !== dayState.scheduleItems.length) {
      dayState.scheduleItems = filteredItems;
      this.saveDayState(dateStr, dayState);
    }
    
    return filteredItems;
  }

  saveSchedule(dateStr, scheduleItems) {
    const dayState = this.getDayState(dateStr) || { date: dateStr, notDoneReasons: [] };
    dayState.scheduleItems = scheduleItems;
    this.saveDayState(dateStr, dayState);
  }

  getTimeTemplates() {
    return wx.getStorageSync(STORAGE_KEYS.TIME_TEMPLATES) || [];
  }

  saveTimeTemplates(templates) {
    wx.setStorageSync(STORAGE_KEYS.TIME_TEMPLATES, templates);
  }

  addTask(task) {
    const tasks = this.getTasks();
    
    task.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    task.createdAt = new Date().toISOString();
    task.status = task.status || 'todo';
    task.priority = task.priority === 'medium' ? 'mid' : (task.priority || 'mid');
    
    if (task.isFixed) {
      if (task.startTime && task.endTime) {
        const startMins = timeToMinutes(task.startTime);
        const endMins = timeToMinutes(task.endTime);
        
        if (endMins <= startMins) {
          console.error('Invalid time range: end must be after start');
          return null;
        }
        
        if (endMins >= 1440) {
          console.error('Invalid time range: end time exceeds 24:00');
          return null;
        }
        
        task.minutes = endMins - startMins;
      } else if (task.startTime && task.minutes) {
        const startMins = timeToMinutes(task.startTime);
        const endMins = startMins + task.minutes;
        
        if (endMins >= 1440) {
          console.error('Invalid time range: calculated end time exceeds 24:00');
          return null;
        }
        
        task.endTime = minutesToTime(endMins);
      } else if (!task.minutes) {
        task.minutes = 30;
      }
      
      task.repeatRule = task.repeatRule || null;
    } else {
      task.startTime = null;
      task.endTime = null;
      task.repeatRule = null;
      
      if (!task.minutes) {
        task.minutes = 30;
      }
    }
    
    tasks.push(task);
    this.saveTasks(tasks);
    return task;
  }

  updateTask(taskId, updates) {
    const tasks = this.getTasks();
    const index = tasks.findIndex(t => t.id === taskId);
    
    if (index === -1) {
      return null;
    }
    
    const current = tasks[index];
    const merged = { ...current, ...updates };
    
    if (updates.priority === 'medium') {
      merged.priority = 'mid';
    }
    
    if (merged.isFixed) {
      if (updates.startTime !== undefined || updates.endTime !== undefined || updates.minutes !== undefined) {
        if (updates.startTime && updates.endTime) {
          const startMins = timeToMinutes(updates.startTime);
          const endMins = timeToMinutes(updates.endTime);
          
          if (endMins <= startMins || endMins >= 1440) {
            console.error('Invalid time range in update');
            return null;
          }
          
          merged.minutes = endMins - startMins;
          merged.startTime = updates.startTime;
          merged.endTime = updates.endTime;
        } else if (updates.startTime && updates.minutes) {
          const startMins = timeToMinutes(updates.startTime);
          const endMins = startMins + updates.minutes;
          
          if (endMins >= 1440) {
            console.error('Invalid time range in update');
            return null;
          }
          
          merged.startTime = updates.startTime;
          merged.endTime = minutesToTime(endMins);
          merged.minutes = updates.minutes;
        } else if (merged.startTime && merged.minutes) {
          const startMins = timeToMinutes(merged.startTime);
          const endMins = startMins + merged.minutes;
          
          if (endMins >= 1440) {
            console.error('Invalid time range in update');
            return null;
          }
          
          merged.endTime = minutesToTime(endMins);
        }
      }
    }
    
    tasks[index] = merged;
    this.saveTasks(tasks);
    return merged;
  }

  deleteTask(taskId) {
    const tasks = this.getTasks();
    const filtered = tasks.filter(t => t.id !== taskId);
    this.saveTasks(filtered);
    
    const dayStates = this.getDayStates();
    
    for (const dateStr in dayStates) {
      const dayState = dayStates[dateStr];
      
      if (dayState.scheduleItems) {
        dayState.scheduleItems = dayState.scheduleItems.filter(item => item.taskId !== taskId);
      }
      
      if (dayState.conflictFixedTaskIds) {
        dayState.conflictFixedTaskIds = dayState.conflictFixedTaskIds.filter(id => id !== taskId);
      }
      
      if (dayState.overflowTaskIds) {
        dayState.overflowTaskIds = dayState.overflowTaskIds.filter(id => id !== taskId);
      }
    }
    
    this.saveDayStates(dayStates);
  }

  addTimeTemplate(template) {
    const templates = this.getTimeTemplates();
    template.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    templates.push(template);
    this.saveTimeTemplates(templates);
    return template;
  }

  updateTimeTemplate(id, updates) {
    const templates = this.getTimeTemplates();
    const index = templates.findIndex(t => t.id === id);
    if (index !== -1) {
      templates[index] = { ...templates[index], ...updates };
      this.saveTimeTemplates(templates);
    }
  }

  deleteTimeTemplate(id) {
    const templates = this.getTimeTemplates();
    const filtered = templates.filter(t => t.id !== id);
    this.saveTimeTemplates(filtered);
  }

  seedData() {
    this.seedTasks();
    this.seedTimeTemplates();
  }

  seedTasks() {
    const tasks = [
      {
        title: '晨间阅读',
        category: '学习',
        minutes: 30,
        isFixed: true,
        startTime: '08:00',
        endTime: '08:30',
        repeatRule: 'daily',
        status: 'todo',
        priority: 'high'
      },
      {
        title: '整理项目文档',
        category: '工作',
        minutes: 45,
        isFixed: false,
        status: 'todo',
        priority: 'high'
      },
      {
        title: '回复邮件',
        category: '工作',
        minutes: 30,
        isFixed: false,
        status: 'todo',
        priority: 'high'
      },
      {
        title: '健身训练',
        category: '生活',
        minutes: 60,
        isFixed: true,
        startTime: '18:30',
        endTime: '19:30',
        repeatRule: 'daily',
        status: 'todo',
        priority: 'high'
      },
      {
        title: '英语单词',
        category: '学习',
        minutes: 20,
        isFixed: false,
        status: 'todo',
        priority: 'high'
      }
    ];

    tasks.forEach(task => {
      task.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      task.createdAt = new Date().toISOString();
    });

    this.saveTasks(tasks);
  }

  seedTimeTemplates() {
    const templates = [
      {
        id: 'template1',
        start: '09:00',
        end: '12:00',
        label: '上午专注时间'
      },
      {
        id: 'template2',
        start: '14:00',
        end: '18:00',
        label: '下午工作块'
      }
    ];

    this.saveTimeTemplates(templates);
  }
}

module.exports = new Store();
