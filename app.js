App({
  globalData: {
    currentDate: new Date(),
  },
  onLaunch() {
    const store = require('./utils/store');
    
    // 检查是否需要重新初始化假数据（用于测试）
    const needReset = wx.getStorageSync('reset_test_data');
    const isFirstLaunch = !wx.getStorageSync('app_launched');
    
    if (isFirstLaunch || needReset) {
      console.log('初始化测试数据...');
      store.seedData();
      wx.setStorageSync('app_launched', true);
      wx.setStorageSync('reset_test_data', false);
    }
    
    // 添加调试方法到全局
    this.resetTestData = () => {
      store.clearAllData();
      store.seedData();
      console.log('测试数据已重置，请刷新页面');
    };
    
    this.clearAllData = () => {
      store.clearAllData();
      console.log('所有数据已清空');
    };
  }
})
