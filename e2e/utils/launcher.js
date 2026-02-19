/**
 * DevTools 启动器 - 自动探测并启动微信开发者工具
 */
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const config = require('../config');

class DevToolsLauncher {
  constructor() {
    this.appPath = null;
    this.cliPath = null;
  }

  /**
   * 探测 DevTools 安装路径
   */
  detectPaths() {
    // 探测 App 路径
    for (const appPath of config.devtools.appPaths) {
      if (fs.existsSync(appPath)) {
        this.appPath = appPath;
        console.log(`✅ 找到 DevTools App: ${appPath}`);
        break;
      }
    }

    if (!this.appPath) {
      console.error('❌ 错误：找不到微信开发者工具');
      console.error('   请确保已安装以下之一：');
      config.devtools.appPaths.forEach(p => console.error(`   - ${p}`));
      process.exit(1);
    }

    // 探测 CLI 路径
    for (const cliPath of config.devtools.cliPaths) {
      if (fs.existsSync(cliPath)) {
        this.cliPath = cliPath;
        console.log(`✅ 找到 DevTools CLI: ${cliPath}`);
        break;
      }
    }

    if (!this.cliPath) {
      console.error('❌ 错误：找不到 DevTools CLI');
      process.exit(1);
    }
  }

  /**
   * 检查端口是否已监听
   */
  async isPortListening(port) {
    return new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${port}/json`, (res) => {
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(1000, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  /**
   * 启动 DevTools
   */
  async launch() {
    this.detectPaths();

    // 检查是否已在运行
    const isRunning = await this.isPortListening(config.port);
    if (isRunning) {
      console.log(`✅ DevTools 已在运行（端口 ${config.port}）`);
      return { alreadyRunning: true };
    }

    console.log(`🚀 启动 DevTools（端口 ${config.port}）...`);
    console.log(`   项目: ${config.projectPath}`);

    // 使用 open -a 启动 GUI
    const openCmd = `open -a "${this.appPath}"`;
    
    return new Promise((resolve, reject) => {
      exec(openCmd, (error) => {
        if (error) {
          console.error('❌ 启动 DevTools 失败:', error.message);
          reject(error);
          return;
        }

        console.log('⏳ 等待 DevTools 启动...');
        resolve({ alreadyRunning: false });
      });
    });
  }

  /**
   * 等待 DevTools 就绪
   */
  async waitForReady() {
    const { maxRetries, retryInterval } = config.connection;
    
    console.log(`⏳ 等待 DevTools 就绪（端口 ${config.port}）...`);
    console.log(`   最多等待 ${maxRetries} 秒...`);

    for (let i = 0; i < maxRetries; i++) {
      const isReady = await this.isPortListening(config.port);
      
      if (isReady) {
        console.log(`✅ DevTools 已就绪（端口 ${config.port}）`);
        return true;
      }

      process.stdout.write(`   尝试 ${i + 1}/${maxRetries}...\r`);
      await this.sleep(retryInterval);
    }

    // 超时失败
    console.error('\n❌ DevTools 连接超时');
    console.error(`\n诊断信息：`);
    console.error(`   DevTools App 路径: ${this.appPath || '未找到'}`);
    console.error(`   DevTools CLI 路径: ${this.cliPath || '未找到'}`);
    console.error(`   项目路径: ${config.projectPath}`);
    console.error(`   目标端口: ${config.port}`);
    console.error(`\n可能的解决方案：`);
    console.error('   1. 请确保微信开发者工具已安装');
    console.error('   2. 请确保在 DevTools → 设置 → 安全 中开启了「服务端口」');
    console.error(`   3. 请确认服务端口为 ${config.port}`);
    console.error('   4. 尝试重启微信开发者工具后再运行测试');
    
    throw new Error(`无法连接到 DevTools（端口 ${config.port}）`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = DevToolsLauncher;
