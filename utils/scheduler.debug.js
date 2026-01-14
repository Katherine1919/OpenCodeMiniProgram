const { generateSchedule, shouldShowFixed, timeToMinutes } = require('./scheduler');

function runTests() {
  console.log('========== Scheduler Debug Tests ==========');
  
  const templates = [
    { id: 't1', start: '09:00', end: '12:00', label: '上午' },
    { id: 't2', start: '14:00', end: '18:00', label: '下午' }
  ];
  
  const date = '2024-01-15';
  
  console.log('\n[Test 1] repeatRule 为 null 的两个 fixed 都能进入');
  const tasks1 = [
    { id: 'f1', title: 'Fixed 1', isFixed: true, startTime: '09:00', endTime: '10:00', minutes: 60, repeatRule: null, status: 'todo', createdAt: '2024-01-01T00:00:00Z' },
    { id: 'f2', title: 'Fixed 2', isFixed: true, startTime: '10:30', endTime: '11:00', minutes: 30, repeatRule: null, status: 'todo', createdAt: '2024-01-01T00:00:00Z' }
  ];
  const result1 = generateSchedule(tasks1, templates, date);
  console.log('Fixed items count:', result1.scheduleItems.filter(it => it.isFixed).length, 'Expected: 2');
  console.assert(result1.scheduleItems.filter(it => it.isFixed).length === 2, 'Test 1 failed');
  
  console.log('\n[Test 2] fixed 冲突被标记');
  const tasks2 = [
    { id: 'f1', title: 'Fixed 1', isFixed: true, startTime: '09:00', endTime: '10:00', minutes: 60, repeatRule: null, status: 'todo', createdAt: '2024-01-01T00:00:00Z' },
    { id: 'f2', title: 'Fixed 2 (conflict)', isFixed: true, startTime: '09:30', endTime: '10:30', minutes: 60, repeatRule: null, status: 'todo', createdAt: '2024-01-01T00:00:00Z' }
  ];
  const result2 = generateSchedule(tasks2, templates, date);
  const conflictItems = result2.scheduleItems.filter(it => it.conflict);
  console.log('Conflict items count:', conflictItems.length, 'Expected: >=1');
  console.log('ConflictFixedTaskIds:', result2.conflictFixedTaskIds);
  console.assert(result2.conflictFixedTaskIds.length >= 1, 'Test 2 failed');
  
  console.log('\n[Test 3] fixed 不在模板内被标记');
  const tasks3 = [
    { id: 'f1', title: 'Fixed out of template', isFixed: true, startTime: '08:00', endTime: '08:30', minutes: 30, repeatRule: null, status: 'todo', createdAt: '2024-01-01T00:00:00Z' }
  ];
  const result3 = generateSchedule(tasks3, templates, date);
  console.log('OutOfTemplateFixedTaskIds:', result3.outOfTemplateFixedTaskIds);
  console.assert(result3.outOfTemplateFixedTaskIds.length === 1, 'Test 3 failed');
  
  console.log('\n[Test 4] fixed start+minutes 推导 endTime');
  const task4 = { id: 'f1', title: 'Fixed', isFixed: true, startTime: '09:00', minutes: 30, status: 'todo', createdAt: '2024-01-01T00:00:00Z', repeatRule: null };
  const result4 = generateSchedule([task4], templates, date);
  const item4 = result4.scheduleItems.find(it => it.taskId === 'f1');
  console.log('End time:', item4?.end, 'Expected: 09:30');
  console.assert(item4?.end === '09:30', 'Test 4 failed');
  
  console.log('\n[Test 5] flexible 能避开 fixed 放入空档');
  const tasks5 = [
    { id: 'f1', title: 'Fixed', isFixed: true, startTime: '09:00', endTime: '10:00', minutes: 60, repeatRule: null, status: 'todo', createdAt: '2024-01-01T00:00:00Z' },
    { id: 'n1', title: 'Normal', isFixed: false, minutes: 30, status: 'todo', priority: 'high', createdAt: '2024-01-01T00:00:00Z' }
  ];
  const result5 = generateSchedule(tasks5, templates, date);
  const normalItem = result5.scheduleItems.find(it => it.taskId === 'n1');
  console.log('Normal task placed:', normalItem ? 'Yes' : 'No', 'Expected: Yes');
  console.log('Normal task start:', normalItem?.start);
  console.assert(normalItem !== undefined, 'Test 5 failed');
  
  console.log('\n[Test 6] flexible 放不下进入 overflow');
  const tasks6 = [
    { id: 'n1', title: 'Huge task', isFixed: false, minutes: 500, status: 'todo', priority: 'high', createdAt: '2024-01-01T00:00:00Z' }
  ];
  const result6 = generateSchedule(tasks6, templates, date);
  console.log('OverflowTaskIds:', result6.overflowTaskIds);
  console.assert(result6.overflowTaskIds.includes('n1'), 'Test 6 failed');
  
  console.log('\n[Test 7] priority mid/medium 排序一致');
  const tasks7 = [
    { id: 'n1', title: 'Mid', isFixed: false, minutes: 30, status: 'todo', priority: 'mid', createdAt: '2024-01-01T00:00:00Z' },
    { id: 'n2', title: 'Medium', isFixed: false, minutes: 30, status: 'todo', priority: 'medium', createdAt: '2024-01-01T00:00:00Z' },
    { id: 'n3', title: 'High', isFixed: false, minutes: 30, status: 'todo', priority: 'high', createdAt: '2024-01-01T00:00:00Z' }
  ];
  const result7 = generateSchedule(tasks7, templates, date);
  const placedOrder = result7.scheduleItems.filter(it => !it.isFixed).map(it => it.taskId);
  console.log('Placed order:', placedOrder, 'Expected: n3 first');
  console.assert(placedOrder[0] === 'n3', 'Test 7 failed');
  
  console.log('\n[Test 8] Invalid time 被标记');
  const tasks8 = [
    { id: 'f1', title: 'Invalid', isFixed: true, startTime: '23:00', endTime: '22:00', minutes: -60, repeatRule: null, status: 'todo', createdAt: '2024-01-01T00:00:00Z' }
  ];
  const result8 = generateSchedule(tasks8, templates, date);
  console.log('InvalidFixedTaskIds:', result8.invalidFixedTaskIds);
  console.assert(result8.invalidFixedTaskIds.length === 1, 'Test 8 failed');
  
  console.log('\n========== All Tests Completed ==========');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runTests };
}
