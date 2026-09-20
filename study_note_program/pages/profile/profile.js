const app = getApp();

Page({
  data: {
    isLogin: false,       // 登录状态
    userInfo: {},         // 用户信息
    defaultAvatarUrl: ''  // 默认头像地址
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    if(!app.globalData.isLogin){
         // 根据本地缓存设置登录状态
    const userInfo = wx.getStorageSync('userInfo');
    console.log(userInfo)
    if (userInfo) {
      app.globalData.userInfo = {
        id: userInfo.id,
        nickName: userInfo.nickName,
        userAvatar: userInfo.userAvatar,
        userName: userInfo.userName
      };
      app.globalData.isLogin = true;
    }
    }
    // 初始化页面数据
    this.initUserData();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    if(!app.globalData.isLogin){
      // 根据本地缓存设置登录状态
 const userInfo = wx.getStorageSync('userInfo');
 if (userInfo) {
   app.globalData.userInfo = {
     id: userInfo.id,
     nickName: userInfo.nickName,
     userAvatar: userInfo.userAvatar,
     userName: userInfo.userName
   };
   app.globalData.isLogin = true;
 }
 console.log(userInfo)
}
    // 每次显示页面都重新检查登录状态
    this.initUserData();
  },

  /**
   * 初始化用户数据
   */
  initUserData() {
    const isLogin=app.globalData.isLogin;
    const userInfo=app.globalData.userInfo;
    const defaultAvatarUrl=app.globalData.defaultAvatarUrl;
    this.setData({
      isLogin,
      userInfo: userInfo,
      defaultAvatarUrl
    });
    console.log(userInfo)
  },

  /**
   * 跳转到登录页面
   */
  goToLogin() {
    if (!this.data.isLogin) {
      wx.navigateTo({
        url: '/pages/login/login'
      });
    }
  },

  /**
   * 跳转到账号信息页面
   */
  goToMyInfo() {
    this.checkLoginAndNavigate('/pages/my-info/my-info');
  },

  /**
   * 跳转到个人笔记页面
   */
  goToMyNote() {
    this.toSwitch('/pages/my-note/my-note');
  },

  /**
   * 跳转到我的收藏页面
   */
  goToCollectList() {
    this.checkLoginAndNavigate('/pages/collect-list/collect-list');
  },

  /**
   * 跳转到分类管理页面
   */
  goToCategory() {
    this.checkLoginAndNavigate('/pages/category/category');
  },

  toSwitch(url) {
    if (this.data.isLogin) {
      wx.switchTab({ url });
    } else {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 2000
      });
      // 自动跳转到登录页
      setTimeout(() => {
        this.goToLogin();
      }, 1500);
    }
  },

  /**
   * 检查登录状态并跳转
   * @param {string} url 目标页面地址
   */
  checkLoginAndNavigate(url) {
    if (this.data.isLogin) {
      wx.navigateTo({ url });
    } else {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 2000
      });
      // 自动跳转到登录页
      setTimeout(() => {
        this.goToLogin();
      }, 1500);
    }
  },

  /**
   * 退出登录（核心修改：调用后端接口 + 完整清除缓存）
   */
  logout() {
    wx.showModal({
      title: '确认退出',
      content: '是否确定退出登录？',
      success: (res) => {
        if (res.confirm) {
          // 1. 获取用户ID和全局配置
          const { userInfo } = app.globalData;
          const userId = userInfo.id;
          const baseUrl = app.globalData.baseUrl;

          // 2. 校验用户ID（避免空参数调用接口）
          if (!userId) {
            this.clearLocalData(); // 本地强制清除
            wx.showToast({
              title: '退出登录成功',
              icon: 'success',
              duration: 2000
            });
            return;
          }

          // 3. 显示加载中
          wx.showLoading({ title: '退出中...' });

          // 4. 调用后端退出登录接口
          wx.request({
            url: `${baseUrl}user/logout`,
            method: 'GET',
            data: { userId }, // 传入用户ID
            success: (res) => {
              wx.hideLoading();
              if (res.data.code === 200) {
                // 接口调用成功：清除本地数据 + 更新状态
                this.clearLocalData();
                wx.showToast({
                  title: '退出登录成功',
                  icon: 'success',
                  duration: 2000
                });
          
              } else {
                // 接口调用失败：提示错误，但仍清除本地数据（避免状态不一致）
                this.clearLocalData();
                wx.showToast({
                  title: res.data.msg || '退出登录失败',
                  icon: 'none',
                  duration: 2000
                });
              }
            },
            fail: (err) => {
              // 网络错误：提示 + 本地强制清除
              wx.hideLoading();
              this.clearLocalData();
              wx.showToast({
                title: '网络错误，已本地退出',
                icon: 'none',
                duration: 2000
              });
              console.error('退出登录接口调用失败：', err);
            }
          });
        }
      }
    });
  },

  /**
   * 清除本地缓存 + 更新全局/页面状态（抽离为独立方法，便于复用）
   */
  clearLocalData() {
    // 1. 清除本地缓存（用户信息 + Token）
    wx.removeStorageSync('userInfo');
    wx.removeStorageSync('tokenInfo');

    // 2. 重置全局状态
    app.globalData.isLogin = false;
    app.globalData.userInfo = {
      id: '',
      userName: '',
      nickName: '',
      userAvatar: app.globalData.defaultAvatarUrl
    };
    app.globalData.tokenInfo = {};

    // 3. 更新页面状态
    this.setData({
      isLogin: false,
      userInfo: {}
    });
  }
});