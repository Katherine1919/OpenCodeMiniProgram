/**
 * E2E 测试配置
 * 端口：51557（用户机器固定端口）
 */
const path = require('path');
const fs = require('fs');

// 端口配置：支持环境变量覆盖，默认 51557
const DEVTOOLS_PORT = Number(process.env.DEVTOOLS_PORT || 51557);

// 项目路径检测
const projectPath = process.cwd().replace('/e2e', '');

// 验证项目路径
if (!fs.existsSync(path.join(projectPath, 'project.config.json'))) {
  console.error('❌ 错误：找不到 project.config.json');
  console.error(`   请确认项目路径正确: ${projectPath}`);
  console.error('   或者从 e2e 目录运行: cd /Users/Zhuanz/Downloads/OpenCodePlanner/e2e');
  process.exit(1);
}

module.exports = {
  // 服务端口（固定 51557）
  port: DEVTOOLS_PORT,
  
  // 开发者工具配置
  devtools: {
    // 可能的 App 路径（macOS）
    appPaths: [
      '/Applications/wechatwebdevtools.app',
      '/Applications/微信开发者工具.app'
    ],
    
    // CLI 路径
    cliPaths: [
      '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
      '/Applications/wechatwebdevtools.app/Contents/MacOS/wechatwebdevtools',
      '/Applications/微信开发者工具.app/Contents/MacOS/cli',
      '/Applications/微信开发者工具.app/Contents/MacOS/微信开发者工具'
    ]
  },
  
  // 小程序项目路径
  projectPath: projectPath,
  
  // 连接重试配置
  connection: {
    maxRetries: 60,      // 最多 60 次
    retryInterval: 1000, // 每 1 秒
    startupDelay: 5000   // 启动后等待 5 秒
  },
  
  // 截图配置
  screenshots: {
    baselineDir: './screenshots/baseline',
    currentDir: './screenshots/current',
    diffDir: './screenshots/diff',
    threshold: 0.1,
    pixelThreshold: 100
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
  
  // Mock 数据
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
  
  // 超时配置
  timeouts: {
    launch: 30000,
    navigate: 10000,
    render: 3000,
    scroll: 2000
  }
};
