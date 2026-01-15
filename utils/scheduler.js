function timeToMinutes(time) {
  if (!time || typeof time !== 'string') return 0;
  const parts = time.split(':');
  if (parts.length !== 2) return 0;
  const [h, m] = parts.map(Number);
  if (isNaN(h) || isNaN(m)) return 0;
  return h * 60 + m;
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function shouldShowFixed(task, date) {
  if (!task.isFixed) return false;
  if (task.status === 'done') return false;
  
  if (!task.repeatRule || task.repeatRule === 'daily') {
    return true;
  }
  
  if (!task.createdAt) return true;
  
  const taskDate = new Date(task.createdAt);
  const targetDate = new Date(date);
  
  if (isNaN(taskDate.getTime()) || isNaN(targetDate.getTime())) {
    return true;
  }
  
  if (task.repeatRule === 'weekly') {
    return taskDate.getDay() === targetDate.getDay();
  } else if (task.repeatRule === 'biweekly') {
    const daysDiff = Math.floor((targetDate - taskDate) / (1000 * 60 * 60 * 24));
    const weeksDiff = Math.floor(daysDiff / 7);
    return taskDate.getDay() === targetDate.getDay() && weeksDiff % 2 === 0;
  } else if (task.repeatRule === 'monthly') {
    return taskDate.getDate() === targetDate.getDate();
  }
  
  return true;
}

function findTemplateForRange(startMin, endMin, templates) {
  for (const tmpl of templates) {
    const tmplStart = timeToMinutes(tmpl.start);
    const tmplEnd = timeToMinutes(tmpl.end);
    if (tmplStart <= startMin && endMin <= tmplEnd) {
      return tmpl;
    }
  }
  return null;
}

function canPlace(startMin, endMin, tmpl, usedSlotsInTemplate) {
  const tmplStart = timeToMinutes(tmpl.start);
  const tmplEnd = timeToMinutes(tmpl.end);
  
  if (startMin < tmplStart || endMin > tmplEnd) {
    return false;
  }
  
  if (startMin >= endMin) {
    return false;
  }
  
  const hasConflict = usedSlotsInTemplate.some(slot => 
    !(endMin <= slot.start || startMin >= slot.end)
  );
  
  return !hasConflict;
}

function validateSchedule(scheduleItems, templates) {
  const validItems = [];
  const invalidTaskIds = [];
  
  for (const item of scheduleItems) {
    const startMin = timeToMinutes(item.start);
    const endMin = timeToMinutes(item.end);
    
    if (startMin >= endMin) {
      console.warn(`Schedule validation: invalid range start>=end for taskId ${item.taskId} (${item.start}-${item.end})`);
      invalidTaskIds.push(item.taskId);
      continue;
    }
    
    const tmpl = findTemplateForRange(startMin, endMin, templates);
    if (!tmpl) {
      console.warn(`Schedule validation: taskId ${item.taskId} (${item.start}-${item.end}) not in any template. Templates: ${templates.map(t => `${t.start}-${t.end}`).join(', ')}`);
      invalidTaskIds.push(item.taskId);
      continue;
    }
    
    const sameTemplateItems = validItems.filter(it => {
      const itStart = timeToMinutes(it.start);
      const itEnd = timeToMinutes(it.end);
      const itTmpl = findTemplateForRange(itStart, itEnd, templates);
      return itTmpl && itTmpl.id === tmpl.id;
    });
    
    const usedSlotsInTemplate = sameTemplateItems.map(it => ({
      start: timeToMinutes(it.start),
      end: timeToMinutes(it.end)
    }));
    
    if (!canPlace(startMin, endMin, tmpl, usedSlotsInTemplate)) {
      console.warn(`Schedule validation: taskId ${item.taskId} (${item.start}-${item.end}) has conflict or out of template boundaries`);
      invalidTaskIds.push(item.taskId);
      continue;
    }
    
    validItems.push(item);
  }
  
  return validItems;
}

function generateSchedule(tasks, templates, date) {
  const items = [];
  const usedSlotsByTemplate = new Map();
  const conflictFixedTaskIds = [];
  const overflowTaskIds = [];
  
  templates.forEach(tmpl => {
    usedSlotsByTemplate.set(tmpl.id, []);
  });
  
  templates.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  
  const fixedTasks = tasks.filter(t => {
    if (!t.isFixed) return false;
    if (t.status === 'done') return false;
    return shouldShowFixed(t, date);
  });
  
  const normalTasks = tasks.filter(t => 
    !t.isFixed &&
    (t.status === 'todo' || t.status === 'scheduled' || t.status === 'overflow')
  );
  
  fixedTasks.forEach(task => {
    if (!task.startTime || !task.endTime) return;
    
    const startMin = timeToMinutes(task.startTime);
    const endMin = timeToMinutes(task.endTime);
    
    if (endMin <= startMin || endMin > 1440) return;
    
    const tmpl = findTemplateForRange(startMin, endMin, templates);
    
    if (!tmpl) {
      console.warn(`Fixed task ${task.id} (${task.startTime}-${task.endTime}) not in any template, marking as overflow`);
      overflowTaskIds.push(task.id);
      return;
    }
    
    const usedSlots = usedSlotsByTemplate.get(tmpl.id) || [];
    
    if (!canPlace(startMin, endMin, tmpl, usedSlots)) {
      console.warn(`Fixed task ${task.id} (${task.startTime}-${task.endTime}) has conflict in template ${tmpl.start}-${tmpl.end}, marking as overflow`);
      conflictFixedTaskIds.push(task.id);
      overflowTaskIds.push(task.id);
      return;
    }
    
    items.push({
      id: `sched_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      taskId: task.id,
      kind: 'task',
      title: task.title,
      start: task.startTime,
      end: task.endTime,
      minutes: endMin - startMin,
      status: 'scheduled',
      isAutoGenerated: true,
      isFixed: true,
      conflict: false
    });
    
    usedSlots.push({ start: startMin, end: endMin });
    usedSlotsByTemplate.set(tmpl.id, usedSlots);
  });
  
  normalTasks.sort((a, b) => {
    const priorityMap = {high: 3, mid: 2, medium: 2, low: 1};
    if (a.priority !== b.priority) {
      return (priorityMap[b.priority] || 1) - (priorityMap[a.priority] || 1);
    }
    if (a.ddl && b.ddl) {
      return new Date(a.ddl) - new Date(b.ddl);
    }
    if (a.ddl) return -1;
    if (b.ddl) return 1;
    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
  });
  
  normalTasks.forEach(task => {
    if (!task.minutes || task.minutes <= 0) return;
    
    let placed = false;
    
    for (const tmpl of templates) {
      if (placed) break;
      
      const tmplStartMin = timeToMinutes(tmpl.start);
      const tmplEndMin = timeToMinutes(tmpl.end);
      const usedSlots = usedSlotsByTemplate.get(tmpl.id) || [];
      
      const sortedSlots = [...usedSlots].sort((a, b) => a.start - b.start);
      
      let cursor = tmplStartMin;
      
      for (let i = 0; i <= sortedSlots.length; i++) {
        const nextSlotStart = sortedSlots[i]?.start || tmplEndMin;
        const gap = nextSlotStart - cursor;
        
        if (gap >= task.minutes && cursor + task.minutes <= tmplEndMin) {
          items.push({
            id: `sched_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            taskId: task.id,
            kind: 'task',
            title: task.title,
            start: minutesToTime(cursor),
            end: minutesToTime(cursor + task.minutes),
            minutes: task.minutes,
            status: 'scheduled',
            isAutoGenerated: true,
            isFixed: false
          });
          
          usedSlots.push({ start: cursor, end: cursor + task.minutes });
          usedSlotsByTemplate.set(tmpl.id, usedSlots);
          placed = true;
          break;
        }
        
        if (sortedSlots[i]) {
          cursor = sortedSlots[i].end;
        }
      }
    }
    
    if (!placed) {
      overflowTaskIds.push(task.id);
    }
  });
  
  const validItems = validateSchedule(items, templates);
  
  const placedTaskIds = validItems.map(it => it.taskId);
  const overflowTaskIdsFinal = [...new Set([...overflowTaskIds, ...normalTasks.filter(t => !placedTaskIds.includes(t.id)).map(t => t.id)])];
  
  validItems.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  
  return { 
    scheduleItems: validItems, 
    conflictFixedTaskIds,
    overflowTaskIds: overflowTaskIdsFinal
  };
}

module.exports = {
  generateSchedule,
  timeToMinutes,
  minutesToTime,
  shouldShowFixed
};
