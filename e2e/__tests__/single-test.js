/**
 * 单页面快速测试
 * 用法: node single-test.js <page> <scenario>
 * 示例: node single-test.js today heavy
 */
const TestRunner = require('./runner');

const page = process.argv[2] || 'today';
const scenario = process.argv[3] || 'normal';

console.log(`🧪 单测试模式: ${page} - ${scenario}`);

const runner = new TestRunner();

(async () => {
  try {
    await runner.launch();
    await runner.testPageScenario(page, scenario);
    
    const reportPath = runner.report.generateHTML();
    runner.report.generateConsole();
    
    console.log(`\n📊 报告: ${reportPath}`);
    
    await runner.clearMockData();
    await runner.miniProgram.close();
    
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
