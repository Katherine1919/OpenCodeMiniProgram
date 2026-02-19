/**
 * 截图对比工具
 */
const fs = require('fs-extra');
const path = require('path');
const PNG = require('pngjs').PNG;
const pixelmatch = require('pixelmatch');
const config = require('../config');

class ScreenshotComparator {
  constructor() {
    this.baselineDir = path.join(__dirname, '..', config.screenshots.baselineDir);
    this.currentDir = path.join(__dirname, '..', config.screenshots.currentDir);
    this.diffDir = path.join(__dirname, '..', config.screenshots.diffDir);
    
    // 确保目录存在
    fs.ensureDirSync(this.baselineDir);
    fs.ensureDirSync(this.currentDir);
    fs.ensureDirSync(this.diffDir);
  }
  
  /**
   * 保存截图
   */
  async saveScreenshot(buffer, filename, type = 'current') {
    const dir = type === 'baseline' ? this.baselineDir : this.currentDir;
    const filepath = path.join(dir, filename);
    await fs.writeFile(filepath, buffer);
    return filepath;
  }
  
  /**
   * 对比截图
   */
  async compare(baselineFile, currentFile) {
    const baselinePath = path.join(this.baselineDir, baselineFile);
    const currentPath = path.join(this.currentDir, currentFile);
    
    // 如果基线不存在，直接返回
    if (!fs.existsSync(baselinePath)) {
      return {
        matched: false,
        reason: '基线截图不存在',
        diffFile: null,
        diffPixels: 0,
        diffPercentage: 100
      };
    }
    
    // 读取图片
    const baseline = PNG.sync.read(fs.readFileSync(baselinePath));
    const current = PNG.sync.read(fs.readFileSync(currentPath));
    
    // 检查尺寸
    if (baseline.width !== current.width || baseline.height !== current.height) {
      return {
        matched: false,
        reason: `尺寸不匹配: ${baseline.width}x${baseline.height} vs ${current.width}x${current.height}`,
        diffFile: null,
        diffPixels: 0,
        diffPercentage: 100
      };
    }
    
    // 创建 diff 图片
    const diff = new PNG({ width: baseline.width, height: baseline.height });
    
    // 对比像素
    const diffPixels = pixelmatch(
      baseline.data,
      current.data,
      diff.data,
      baseline.width,
      baseline.height,
      {
        threshold: 0.1,
        includeAA: false
      }
    );
    
    // 计算差异百分比
    const totalPixels = baseline.width * baseline.height;
    const diffPercentage = (diffPixels / totalPixels) * 100;
    
    // 保存 diff 图片
    const diffFile = `diff_${currentFile}`;
    const diffPath = path.join(this.diffDir, diffFile);
    fs.writeFileSync(diffPath, PNG.sync.write(diff));
    
    // 判断是否通过
    const matched = diffPercentage <= config.screenshots.threshold &&
                    diffPixels <= config.screenshots.pixelThreshold;
    
    return {
      matched,
      diffPixels,
      diffPercentage: diffPercentage.toFixed(4),
      diffFile,
      reason: matched ? null : `差异: ${diffPixels} 像素 (${diffPercentage.toFixed(2)}%)`
    };
  }
  
  /**
   * 复制当前截图为基线
   */
  async updateBaseline(filename) {
    const currentPath = path.join(this.currentDir, filename);
    const baselinePath = path.join(this.baselineDir, filename);
    
    if (fs.existsSync(currentPath)) {
      await fs.copy(currentPath, baselinePath);
      return true;
    }
    return false;
  }
}

module.exports = ScreenshotComparator;
