App({
  globalData: {
    currentDate: new Date(),
  },
  onLaunch() {
    const store = require('./utils/store');
    const isFirstLaunch = !wx.getStorageSync('app_launched');
    if (isFirstLaunch) {
      store.seedData();
      wx.setStorageSync('app_launched', true);
    }
  }
})
