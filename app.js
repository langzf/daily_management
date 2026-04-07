const { tryInitialPull, flushUpload } = require('./utils/sync');

App({
  globalData: {
    appName: 'Daily Management'
  },

  onLaunch() {
    tryInitialPull().catch(() => {});
  },

  onShow() {
    tryInitialPull().catch(() => {});
  },

  onHide() {
    flushUpload('app-hide');
  }
});
