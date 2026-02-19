/**
 * E2E 视觉回归测试运行器
 * 支持自动启动 DevTools、连接重试、错误处理
 */
const automator = require('miniprogram-automator');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const DevToolsLauncher = require('../utils/launcher');
const ScreenshotComparator = require('../utils/comparator');
const ReportGenerator = require('../utils/report');
const LayoutAssertions = require('../utils/assertions');

class TestRunner {
  constructor() {
    this.launcher = new DevToolsLauncher();
    this.comparator = new ScreenshotComparator();
    this.report = new ReportGenerator();
    this.assertions = null;
    this.miniProgram = null;
    this.updateBaseline = process.env.UPDATE_BASELINE === 'true';
    this.errorLog = [];
  }

  /**
   * Preflight 检查
   */
  async preflight() {
    console.log('🔍 Preflight 检查...\n');

    // 检查项目路径
    if (!fs.existsSync(config.projectPath)) {
      throw new Error(`项目路径不存在: ${config.projectPath}`);
    }
    console.log(`✅ 项目路径: ${config.projectPath}`);

    // 检查 project.config.json
    const configPath = path.join(config.projectPath, 'project.config.json');
    if (!fs.existsSync(configPath)) {
      throw new Error(`找不到 project.config.json: ${configPath}`);
    }
    console.log(`✅ project.config.json 存在`);

    // 检查端口
    console.log(`✅ 目标端口: ${config.port}`);

    // 确保截图目录存在
    ['baseline', 'current', 'diff'].forEach(dir => {
      const dirPath = path.join(__dirname, '..', config.screenshots[`${dir}Dir`]);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    });
    console.log(`✅ 截图目录就绪`);

    console.log('');
  }

  /**
   * 启动并连接 DevTools
   */
  async launch() {
    // Preflight 检查
    await this.preflight();

    // 启动 DevTools（如果没运行）
    const launchResult = await this.launcher.launch();
    
    if (!launchResult.alreadyRunning) {
      // 等待启动
      console.log(`⏳ 等待 ${config.connection.startupDelay}ms 让 DevTools 初始化...`);
      await this.sleep(config.connection.startupDelay);
    }

    // 等待连接就绪
    await this.launcher.waitForReady();

    // 连接 automator
    console.log('🔗 连接 automator...');
    try {
      this.miniProgram = await automator.connect({
        wsEndpoint: `ws://127.0.0.1:${config.port}`,
        projectPath: config.projectPath
      });
      
      this.assertions = new LayoutAssertions(this.miniProgram);
      console.log('✅ 已连接到小程序\n');
    } catch (error) {
      console.error('❌ 连接 automator 失败');
      throw error;
    }
  }

  /**
   * 注入 mock 数据
   */
  async injectMockData(scenario) {
    console.log(`🎭 注入场景数据: ${scenario}`);
    
    try {
      await this.miniProgram.evaluate(() => {
        wx.setStorageSync('e2e_mock_enabled', true);
        wx.removeStorageSync('e2e_mock_ocp_tasks');
        wx.removeStorageSync('e2e_mock_ocp_time_templates');
        wx.removeStorageSync('e2e_mock_ocp_day_states');
      });
      
      if (scenario === 'heavy') {
        await this.generateHeavyData();
      } else {
        const scenarioData = config.mockData.scenarios[scenario];
        await this.miniProgram.evaluate((data) => {
          if (data.tasks) wx.setStorageSync('e2e_mock_ocp_tasks', data.tasks);
          if (data.templates) wx.setStorageSync('e2e_mock_ocp_time_templates', data.templates);
        }, scenarioData);
      }
      
      console.log('✅ Mock 数据已注入');
    } catch (error) {
      console.error('❌ 注入 mock 数据失败:', error.message);
      throw error;
    }
  }

  /**
   * 生成 heavy 数据
   */
  async generateHeavyData() {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    await this.miniProgram.evaluate((dateStr) => {
      const tasks = [];
      const schedule = [];
      
      for (let i = 0; i < 20; i++) {
        const startHour = 9 + Math.floor(i / 3);
        const startMin = (i % 3) * 20;
        const minutes = [30, 45, 60][i % 3];
        
        tasks.push({
          id: `e2e_mock_task_${i}`,
          title: `任务${i + 1}`,
          category: ['工作', '学习', '生活'][i % 3],
          minutes,
          isFixed: i < 3,
          startTime: i < 3 ? `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}` : null,
          endTime: i < 3 ? `${String(startHour).padStart(2, '0')}:${String(startMin + minutes).padStart(2, '0')}` : null,
          status: i < 5 ? 'done' : i < 10 ? 'scheduled' : 'todo',
          priority: ['high', 'mid', 'low'][i % 3],
          createdAt: new Date().toISOString()
        });
        
        schedule.push({
          id: `e2e_mock_sched_${i}`,
          taskId: i < 15 ? `e2e_mock_task_${i}` : null,
          kind: i < 15 ? 'task' : 'break',
          title: i < 15 ? `任务${i + 1}` : '休息',
          start: `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`,
          end: `${String(startHour).padStart(2, '0')}:${String(startMin + minutes).padStart(2, '0')}`,
          minutes,
          status: i < 5 ? 'done' : i < 10 ? 'scheduled' : 'todo',
          isAutoGenerated: true
        });
      }
      
      wx.setStorageSync('e2e_mock_ocp_tasks', tasks);
      wx.setStorageSync('e2e_mock_ocp_day_states', { [dateStr]: { date: dateStr, scheduleItems: schedule, notDoneReasons: [] }});
      wx.setStorageSync('e2e_mock_ocp_time_templates', [
        { id: 'e2e_mock_tmpl_0', start: '09:00', end: '12:00', label: '上午' },
        { id: 'e2e_mock_tmpl_1', start: '14:00', end: '18:00', label: '下午' },
        { id: 'e2e_mock_tmpl_2', start: '20:00', end: '22:00', label: '晚上' }
      ]);
    }, dateStr);
  }

  /**
   * 测试单个页面场景
   */
  async testPageScenario(pageName, scenario) {
    const pageConfig = config.pages[pageName];
    const screenshotName = `${pageName}_${scenario}.png`;
    
    console.log(`\n📸 测试: ${pageName} - ${scenario}`);
    
    try {
      // 注入数据
      await this.injectMockData(scenario);
      
      // 切换页面
      const page = await this.miniProgram.switchTab(pageConfig.path);
      await this.sleep(config.timeouts.navigate);
      
      // 等待渲染
      await page.waitFor('.page-container', config.timeouts.render);
      await this.sleep(500);
      
      // 执行操作
      await this.performPageActions(page, pageName, scenario);
      
      // 截图
      const screenshot = await page.screenshot();
      await this.comparator.saveScreenshot(screenshot, screenshotName, 'current');
      
      // 断言
      const assertions = await this.runAssertions(page, pageName, scenario);
      
      // 对比
      let comparison = null;
      if (!this.updateBaseline) {
        comparison = await this.comparator.compare(screenshotName, screenshotName);
      }
      
      // 更新基线
      if (this.updateBaseline) {
        await this.comparator.updateBaseline(screenshotName);
        console.log('  ✅ 基线已更新');
      }
      
      // 判断结果
      const passed = this.updateBaseline || 
                     (comparison?.matched && assertions.every(a => a.passed));
      
      this.report.addResult({
        page: pageName,
        scenario,
        screenshot: screenshotName,
        passed,
        comparison,
        assertions,
        error: passed ? null : (comparison?.reason || assertions.find(a => !a.passed)?.message)
      });
      
      console.log(`  ${passed ? '✅' : '❌'} ${passed ? '通过' : '失败'}`);
      
    } catch (error) {
      console.error(`  ❌ 错误: ${error.message}`);
      this.errorLog.push({ page: pageName, scenario, error: error.message, stack: error.stack });
      
      // 保存错误截图
      try {
        const page = await this.miniProgram.currentPage();
        const screenshot = await page.screenshot();
        await this.comparator.saveScreenshot(screenshot, `${pageName}_${scenario}_error.png`, 'current');
      } catch (e) {
        // 忽略截图错误
      }
      
      this.report.addResult({
        page: pageName,
        scenario,
        screenshot: screenshotName,
        passed: false,
        error: error.message
      });
    }
  }

  /**
   * 执行页面操作
   */
  async performPageActions(page, pageName, scenario) {
    if (scenario === 'heavy') {
      await page.scrollTo(0, 99999);
      await this.sleep(1000);
    }
  }

  /**
   * 运行断言
   */
  async runAssertions(page, pageName, scenario) {
    const assertions = [];
    
    if (scenario === 'heavy') {
      try {
        const result = await this.assertions.assertLastItemVisible('.timeline, .task-list');
        assertions.push({ name: '最后一项可见', ...result });
      } catch (e) {
        assertions.push({ name: '最后一项可见', passed: false, message: e.message });
      }
    }
    
    return assertions;
  }

  /**
   * 运行所有测试
   */
  async runAll() {
    console.log('='.repeat(60));
    console.log('🎯 视觉回归测试');
    console.log(`   端口: ${config.port}`);
    console.log(`   模式: ${this.updateBaseline ? '更新基线' : '对比测试'}`);
    console.log('='.repeat(60));
    
    try {
      await this.launch();
      
      // 运行所有测试
      for (const [pageName, pageConfig] of Object.entries(config.pages)) {
        console.log(`\n📄 ${pageName}`);
        for (const scenario of pageConfig.scenarios) {
          await this.testPageScenario(pageName, scenario);
        }
      }
      
      // 生成报告
      const reportPath = this.report.generateHTML();
      const stats = this.report.generateConsole();
      
      // 添加错误日志到报告
      if (this.errorLog.length > 0) {
        console.log('\n❌ 错误日志（最后30行）:');
        this.errorLog.slice(-30).forEach((err, i) => {
          console.log(`  ${i + 1}. ${err.page}/${err.scenario}: ${err.error}`);
        });
      }
      
      console.log(`\n📊 报告: ${reportPath}`);
      
      return {
        success: stats.failed === 0,
        stats,
        reportPath
      };
      
    } catch (error) {
      console.error('\n❌ 测试失败:', error.message);
      throw error;
      
    } finally {
      // 清理
      if (this.miniProgram) {
        await this.miniProgram.evaluate(() => {
          wx.removeStorageSync('e2e_mock_enabled');
        });
        console.log('\n👋 测试完成');
      }
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 主入口
if (require.main === module) {
  const runner = new TestRunner();
  runner.runAll()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('\n💥 致命错误:', error.message);
      process.exit(1);
    });
}

module.exports = TestRunner;
