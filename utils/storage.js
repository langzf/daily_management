const { scheduleUpload } = require('./sync');

function getList(key) {
  const list = wx.getStorageSync(key);
  return Array.isArray(list) ? list : [];
}

function setList(key, list) {
  wx.setStorageSync(key, Array.isArray(list) ? list : []);
  scheduleUpload(`setList:${key}`);
}

function nowId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

module.exports = {
  getList,
  setList,
  nowId
};
