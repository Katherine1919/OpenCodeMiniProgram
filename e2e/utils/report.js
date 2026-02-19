/**
 * 测试报告生成器
 */
const fs = require('fs-extra');
const path = require('path');

class ReportGenerator {
  constructor() {
    this.results = [];
    this.reportDir = path.join(__dirname, '..', 'reports');
    fs.ensureDirSync(this.reportDir);
  }
  
  /**
   * 添加测试结果
   */
  addResult(result) {
    this.results.push({
      ...result,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * 生成 HTML 报告
   */
  generateHTML() {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>E2E 视觉回归测试报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    .header {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header h1 { font-size: 24px; margin-bottom: 10px; }
    .stats {
      display: flex;
      gap: 20px;
      margin-top: 15px;
    }
    .stat {
      padding: 10px 20px;
      border-radius: 6px;
      font-weight: bold;
    }
    .stat.passed { background: #e8f5e9; color: #2e7d32; }
    .stat.failed { background: #ffebee; color: #c62828; }
    .result-item {
      background: white;
      padding: 15px;
      margin-bottom: 10px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .result-item.failed { border-left: 4px solid #c62828; }
    .result-item.passed { border-left: 4px solid #2e7d32; }
    .result-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .result-title { font-size: 16px; font-weight: bold; }
    .result-status {
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
    }
    .result-status.passed { background: #e8f5e9; color: #2e7d32; }
    .result-status.failed { background: #ffebee; color: #c62828; }
    .images {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-top: 10px;
    }
    .image-container {
      text-align: center;
    }
    .image-container img {
      width: 100%;
      max-width: 200px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .image-label {
      font-size: 12px;
      color: #666;
      margin-top: 5px;
    }
    .error-msg {
      color: #c62828;
      font-size: 14px;
      margin-top: 10px;
      padding: 10px;
      background: #ffebee;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎯 E2E 视觉回归测试报告</h1>
    <p>生成时间: ${new Date().toLocaleString('zh-CN')}</p>
    <div class="stats">
      <div class="stat passed">通过: ${passed}</div>
      <div class="stat failed">失败: ${failed}</div>
      <div class="stat">总计: ${this.results.length}</div>
    </div>
  </div>
  
  ${this.results.map(result => `
    <div class="result-item ${result.passed ? 'passed' : 'failed'}">
      <div class="result-header">
        <div class="result-title">${result.page} - ${result.scenario}</div>
        <div class="result-status ${result.passed ? 'passed' : 'failed'}">
          ${result.passed ? '通过' : '失败'}
        </div>
      </div>
      
      ${result.assertions ? `
        <div style="font-size: 14px; color: #666; margin-bottom: 10px;">
          ${result.assertions.map(a => `
            <div>${a.passed ? '✓' : '✗'} ${a.name}: ${a.message}</div>
          `).join('')}
        </div>
      ` : ''}
      
      ${result.comparison ? `
        <div style="font-size: 14px; color: #666; margin-bottom: 10px;">
          像素差异: ${result.comparison.diffPixels} | 
          差异率: ${result.comparison.diffPercentage}%
        </div>
      ` : ''}
      
      ${!result.passed && result.error ? `
        <div class="error-msg">${result.error}</div>
      ` : ''}
      
      <div class="images">
        <div class="image-container">
          <img src="../screenshots/baseline/${result.screenshot}" 
               onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><text x=%2250%22 y=%2250%22 text-anchor=%22middle%22>无基线</text></svg>'">
          <div class="image-label">基线</div>
        </div>
        <div class="image-container">
          <img src="../screenshots/current/${result.screenshot}">
          <div class="image-label">当前</div>
        </div>
        ${result.comparison && result.comparison.diffFile ? `
          <div class="image-container">
            <img src="../screenshots/diff/${result.comparison.diffFile}">
            <div class="image-label">差异</div>
          </div>
        ` : ''}
      </div>
    </div>
  `).join('')}
</body>
</html>
    `;
    
    const reportPath = path.join(this.reportDir, `report_${Date.now()}.html`);
    fs.writeFileSync(reportPath, html);
    return reportPath;
  }
  
  /**
   * 生成控制台报告
   */
  generateConsole() {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 视觉回归测试报告');
    console.log('='.repeat(60));
    console.log(`通过: ${passed} | 失败: ${failed} | 总计: ${this.results.length}`);
    console.log('-'.repeat(60));
    
    this.results.forEach(result => {
      const icon = result.passed ? '✓' : '✗';
      const status = result.passed ? '通过' : '失败';
      console.log(`${icon} ${result.page} - ${result.scenario}: ${status}`);
      
      if (!result.passed && result.error) {
        console.log(`  错误: ${result.error}`);
      }
      
      if (result.comparison && !result.comparison.matched) {
        console.log(`  差异: ${result.comparison.diffPixels} 像素 (${result.comparison.diffPercentage}%)`);
      }
    });
    
    console.log('='.repeat(60));
    
    return { passed, failed, total: this.results.length };
  }
}

module.exports = ReportGenerator;
