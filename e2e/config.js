/**
 * E2E 测试配置
 */
module.exports = {
  // 开发者工具路径（macOS）
  devtoolPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
  
  // 小程序项目路径
  projectPath: process.cwd().replace('/e2e', ''),
  
  // 截图配置
  screenshots: {
    baselineDir: './screenshots/baseline',
    currentDir: './screenshots/current',
    diffDir: './screenshots/diff',
    threshold: 0.1, // 差异阈值（百分比）
    pixelThreshold: 100 // 像素差异阈值
  },
  
  // 页面配置
  pages: {
    today: {
      path: 'pages/today/index',
      tabIndex: 0,
      scenarios: ['empty', 'normal', 'heavy']
    },
    schedule: {
      path: 'pages/schedule/index', 
      tabIndex: 1,
      scenarios: ['heavy']
    },
    tasks: {
      path: 'pages/tasks/index',
      tabIndex: 2,
      scenarios: ['heavy']
    },
    review: {
      path: 'pages/review/index',
      tabIndex: 3,
      scenarios: ['empty', 'normal']
    }
  },
  
  // Mock 数据配置
  mockData: {
    enabled: true,
    namespace: 'e2e_mock_',
    scenarios: {
      empty: {
        tasks: [],
        templates: [],
        schedule: []
      },
      normal: {
        tasks: [
          { title: '晨间阅读', category: '学习', minutes: 30, status: 'done' },
          { title: '整理文档', category: '工作', minutes: 45, status: 'scheduled' }
        ],
        templates: [
          { start: '09:00', end: '12:00', label: '上午专注' }
        ]
      },
      heavy: {
        tasks: Array.from({ length: 20 }, (_, i) => ({
          title: `任务${i + 1}`,
          category: ['工作', '学习', '生活'][i % 3],
          minutes: [30, 45, 60][i % 3],
          status: i < 5 ? 'done' : i < 10 ? 'scheduled' : 'todo'
        })),
        templates: [
          { start: '09:00', end: '12:00', label: '上午' },
          { start: '14:00', end: '18:00', label: '下午' },
          { start: '20:00', end: '22:00', label: '晚上' }
        ]
      }
    }
  },
  
  // 等待时间配置
  timeouts: {
    launch: 10000,
    navigate: 5000,
    render: 2000,
    scroll: 1000
  }
};
