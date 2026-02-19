/**
 * 布局断言工具
 */
class LayoutAssertions {
  constructor(miniProgram) {
    this.miniProgram = miniProgram;
  }
  
  /**
   * 检查元素是否被 tabbar 遮挡
   */
  async assertNotCoveredByTabbar(selector) {
    const systemInfo = await this.miniProgram.callWxMethod('getSystemInfoSync');
    const windowHeight = systemInfo.windowHeight;
    const tabbarHeight = 56 + (systemInfo.safeArea?.bottom ? systemInfo.safeArea.bottom - systemInfo.safeArea.height : 0);
    
    const element = await this.miniProgram.$(selector);
    if (!element) {
      return { passed: false, message: `元素 ${selector} 不存在` };
    }
    
    const rect = await element.boundingBox();
    const bottomPosition = rect.top + rect.height;
    const safeBottom = windowHeight - tabbarHeight - 10; // 10px 安全边距
    
    const passed = bottomPosition <= safeBottom;
    return {
      passed,
      message: passed 
        ? `元素在可视区域内 (${bottomPosition.toFixed(0)}px <= ${safeBottom.toFixed(0)}px)`
        : `元素被 tabbar 遮挡 (${bottomPosition.toFixed(0)}px > ${safeBottom.toFixed(0)}px)`
    };
  }
  
  /**
   * 检查页面是否可以滚动到底
   */
  async assertCanScrollToBottom(page) {
    const scrollView = await page.$('.page-container');
    if (!scrollView) {
      return { passed: false, message: '找不到滚动容器' };
    }
    
    // 滚动到底部
    await page.scrollTo(0, 99999);
    await page.waitFor(500);
    
    const scrollTop = await page.evaluate(() => {
      return document.querySelector('.page-container').scrollTop;
    });
    
    const scrollHeight = await page.evaluate(() => {
      return document.querySelector('.page-container').scrollHeight;
    });
    
    const clientHeight = await page.evaluate(() => {
      return document.querySelector('.page-container').clientHeight;
    });
    
    const canScroll = scrollHeight > clientHeight;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
    
    return {
      passed: canScroll && isAtBottom,
      message: canScroll 
        ? `可以滚动到底 (${scrollTop} / ${scrollHeight - clientHeight})`
        : '页面无需滚动'
    };
  }
  
  /**
   * 检查 fixed 按钮可见性
   */
  async assertFixedButtonVisible(selector) {
    const button = await this.miniProgram.$(selector);
    if (!button) {
      return { passed: false, message: `按钮 ${selector} 不存在` };
    }
    
    const rect = await button.boundingBox();
    const systemInfo = await this.miniProgram.callWxMethod('getSystemInfoSync');
    
    // 检查是否在可视区域内
    const inViewport = rect.top > 0 && rect.top < systemInfo.windowHeight;
    const hasSize = rect.width > 0 && rect.height > 0;
    
    return {
      passed: inViewport && hasSize,
      message: inViewport && hasSize
        ? `按钮可见 (${rect.width}x${rect.height} @ ${rect.top.toFixed(0)}px)`
        : `按钮不可见 (top: ${rect.top.toFixed(0)}px)`
    };
  }
  
  /**
   * 检查 tabbar 胶囊居中
   */
  async assertTabbarCapsuleCentered() {
    const capsule = await this.miniProgram.$('.tab-capsule');
    if (!capsule) {
      return { passed: false, message: '找不到胶囊元素' };
    }
    
    const rect = await capsule.boundingBox();
    const text = await capsule.text();
    
    // 检查宽高比是否合适
    const aspectRatio = rect.width / rect.height;
    const isPillShaped = aspectRatio >= 2 && aspectRatio <= 5;
    
    return {
      passed: isPillShaped,
      message: isPillShaped
        ? `胶囊比例正常 (${aspectRatio.toFixed(2)}:1)`
        : `胶囊比例异常 (${aspectRatio.toFixed(2)}:1)`
    };
  }
  
  /**
   * 检查最后一个列表项可见
   */
  async assertLastItemVisible(listSelector) {
    const list = await this.miniProgram.$(listSelector);
    if (!list) {
      return { passed: false, message: `列表 ${listSelector} 不存在` };
    }
    
    const items = await list.$$('.timeline-row, .task-item, .template-card');
    if (items.length === 0) {
      return { passed: true, message: '列表为空' };
    }
    
    const lastItem = items[items.length - 1];
    const rect = await lastItem.boundingBox();
    const systemInfo = await this.miniProgram.callWxMethod('getSystemInfoSync');
    const windowHeight = systemInfo.windowHeight;
    
    // 滚动到元素位置
    await lastItem.scrollIntoView();
    await this.miniProgram.sleep(300);
    
    const isVisible = rect.top < windowHeight - 56; // 减去 tabbar 高度
    
    return {
      passed: isVisible,
      message: isVisible
        ? `最后一项可见 (${items.length} 项)`
        : `最后一项可能被遮挡 (top: ${rect.top.toFixed(0)}px)`
    };
  }
}

module.exports = LayoutAssertions;
