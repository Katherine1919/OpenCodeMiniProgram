function getTodayString() {
  const today = new Date();
  return formatDate(today);
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDate(dateStr) {
  return new Date(dateStr);
}

function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) {
    return `${h}小时${m}分钟`;
  } else if (h > 0) {
    return `${h}小时`;
  } else {
    return `${m}分钟`;
  }
}

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatDisplayTime(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function getTodayDateDisplay() {
  const today = new Date();
  const month = String(today.getMonth() + 1);
  const day = String(today.getDate());
  return `${month}月${day}日`;
}

function shouldShowFixedTask(task, todayStr) {
  if (!task.fixed || !task.createdAt) return false;
  
  const today = new Date(todayStr);
  const taskCreatedDate = new Date(task.createdAt.split('T')[0]);
  
  const daysDiff = Math.floor((today - taskCreatedDate) / (1000 * 60 * 60 * 24));
  
  if (task.fixedRepeat === 'weekly') {
    return true;
  } else if (task.fixedRepeat === 'biweekly') {
    const weeksDiff = Math.floor(daysDiff / 7);
    return weeksDiff % 2 === 0;
  } else if (task.fixedRepeat === 'monthly') {
    return today.getDate() === taskCreatedDate.getDate();
  }
  
  return true;
}

function generateSchedule(tasks, timeTemplates, todayStr) {
  const scheduleItems = [];

  timeTemplates.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

  const availableBlocks = timeTemplates.map(t => ({
    start: timeToMinutes(t.start),
    end: timeToMinutes(t.end)
  }));

  const fixedTasks = tasks.filter(t => 
    t.fixed && t.fixedStartTime && t.fixedEndTime && 
    (t.status === 'todo' || t.status === 'scheduled') &&
    shouldShowFixedTask(t, todayStr)
  );
  const flexibleTasks = tasks.filter(t => (t.status === 'todo' || t.status === 'overflow') && !t.fixed);

  fixedTasks.sort((a, b) => timeToMinutes(a.fixedStartTime) - timeToMinutes(b.fixedStartTime));

  flexibleTasks.sort((a, b) => {
    if (a.ddlDate && !b.ddlDate) return -1;
    if (!a.ddlDate && b.ddlDate) return 1;
    if (a.ddlDate && b.ddlDate) {
      return new Date(a.ddlDate) - new Date(b.ddlDate);
    }
    return a.durationMin - b.durationMin;
  });

  const updatedTasks = [...tasks];

  fixedTasks.forEach(task => {
    const taskStart = timeToMinutes(task.fixedStartTime);
    const taskEnd = timeToMinutes(task.fixedEndTime);

    const validBlock = availableBlocks.find(
      block => taskStart >= block.start && taskEnd <= block.end
    );

    if (validBlock) {
      scheduleItems.push({
        id: `schedule_${Date.now()}_${Math.random()}`,
        taskId: task.id,
        type: 'task',
        title: task.title,
        startTime: taskStart,
        endTime: taskEnd,
        durationMin: taskEnd - taskStart,
        status: 'scheduled',
        fixed: true
      });

      const taskIndex = updatedTasks.findIndex(t => t.id === task.id);
      if (taskIndex !== -1) {
        updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], status: 'scheduled' };
      }
    }
  });

  scheduleItems.sort((a, b) => a.startTime - b.startTime);

  for (let i = 0; i < scheduleItems.length - 1; i++) {
    const current = scheduleItems[i];
    const next = scheduleItems[i + 1];
    const gap = next.startTime - current.endTime;
    
    if (gap >= 15) {
      scheduleItems.splice(i + 1, 0, {
        id: `break_${Date.now()}_${Math.random()}`,
        type: 'break',
        title: '休息',
        startTime: current.endTime,
        endTime: current.endTime + 10,
        durationMin: 10,
        status: 'scheduled'
      });
      i++;
    }
  }

  flexibleTasks.forEach(task => {
    let placed = false;

    for (let blockIdx = 0; blockIdx < availableBlocks.length; blockIdx++) {
      if (placed) break;

      const block = { ...availableBlocks[blockIdx] };

      const blockItems = scheduleItems.filter(
        item => item.startTime >= block.start && item.endTime <= block.end
      );
      blockItems.sort((a, b) => a.startTime - b.startTime);

      let currentPos = block.start;

      for (let i = 0; i <= blockItems.length; i++) {
        const nextItemStart = blockItems[i]?.startTime || block.end;

        const gap = nextItemStart - currentPos;

        if (gap >= task.durationMin) {
          scheduleItems.push({
            id: `schedule_${Date.now()}_${Math.random()}`,
            taskId: task.id,
            type: 'task',
            title: task.title,
            startTime: currentPos,
            endTime: currentPos + task.durationMin,
            durationMin: task.durationMin,
            status: 'scheduled',
            fixed: false
          });

          const taskIndex = updatedTasks.findIndex(t => t.id === task.id);
          if (taskIndex !== -1) {
            updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], status: 'scheduled' };
          }

          if (gap - task.durationMin >= 10) {
            scheduleItems.push({
              id: `break_${Date.now()}_${Math.random()}`,
              type: 'break',
              title: '休息',
              startTime: currentPos + task.durationMin,
              endTime: currentPos + task.durationMin + 10,
              durationMin: 10,
              status: 'scheduled'
            });
          }

          placed = true;
          break;
        }

        if (blockItems[i]) {
          currentPos = blockItems[i].endTime;
        }
      }
    }

    if (!placed) {
      const taskIndex = updatedTasks.findIndex(t => t.id === task.id);
      if (taskIndex !== -1) {
        updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], status: 'overflow' };
      }
    }
  });

  scheduleItems.sort((a, b) => a.startTime - b.startTime);

  return {
    scheduleItems,
    updatedTasks,
    overflowTasks: updatedTasks.filter(t => t.status === 'overflow')
  };
}

function getTodaySchedule(tasks, timeTemplates, store) {
  const todayStr = getTodayString();
  const existingDayState = store.getDayState(todayStr);

  if (existingDayState && existingDayState.scheduleItems) {
    return {
      scheduleItems: existingDayState.scheduleItems,
      dayState: existingDayState
    };
  }

  const { scheduleItems, updatedTasks } = generateSchedule(tasks, timeTemplates, todayStr);

  const dayState = {
    date: todayStr,
    availableBlocks: timeTemplates.map(t => ({
      start: timeToMinutes(t.start),
      end: timeToMinutes(t.end)
    })),
    scheduleItems,
    notDoneReasons: existingDayState?.notDoneReasons || []
  };

  store.saveDayState(todayStr, dayState);

  return { scheduleItems, dayState, updatedTasks };
}

module.exports = {
  getTodayString,
  formatDate,
  parseDate,
  formatTime,
  timeToMinutes,
  minutesToTime,
  formatDisplayTime,
  getTodayDateDisplay,
  generateSchedule,
  getTodaySchedule,
  shouldShowFixedTask
};
