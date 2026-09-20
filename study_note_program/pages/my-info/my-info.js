const app = getApp();

Page({
  data: {
    userInfo: {},
    defaultAvatarUrl: '',
    formData: {
      username: '',
      nickname: '',
      phone: ''
    },
    pwdData: {
      oldPwd: '',
      newPwd: '',
      confirmPwd: ''
    },
    saving: false,
    pwdChanging: false
  },

  onLoad(options) {
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      app.globalData.userInfo = {
        id: userInfo.id,
        nickName: userInfo.nickName,
        userAvatar: userInfo.userAvatar,
        userName: userInfo.userName
      };
      app.globalData.isLogin = true;
    }

    if (!app.globalData.isLogin) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.initUserData();
  },

  onShow() {
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      app.globalData.userInfo = {
        id: userInfo.id,
        nickName: userInfo.nickName,
        userAvatar: userInfo.userAvatar,
        userName: userInfo.userName
      };
      app.globalData.isLogin = true;
      this.initUserData();
    }
  },

  initUserData() {
    const { userInfo, defaultAvatarUrl } = app.globalData;
    this.setData({
      userInfo,
      defaultAvatarUrl,
      formData: {
        username: userInfo.userName || '',
        nickname: userInfo.nickName || '',
        phone: userInfo.phone || ''
      }
    });
  },

  // ====================== 【修复】选择头像 ======================
  chooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.uploadAvatar(tempFilePath);
      },
      fail: () => wx.showToast({ title: '选择图片失败', icon: 'none' })
    })
  },

  // ====================== 【修复】上传并保存到数据库 ======================
  uploadAvatar(tempFilePath) {
    wx.showLoading({ title: '上传中...' })

    wx.cloud.uploadFile({
      cloudPath: `user_avatar/${app.globalData.userInfo.id}_${Date.now()}.png`,
      filePath: tempFilePath,
      success: (res) => {
        const cloudFileId = res.fileID;
        // 【关键】调用接口把 fileID 存入数据库
        this.updateAvatarToDB(cloudFileId);
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '上传失败', icon: 'none' })
      }
    })
  },

  // ====================== 【新增】头像入库接口调用 ======================
  updateAvatarToDB(avatarUrl) {
    const userId = app.globalData.userInfo.id;

    wx.request({
      url: `${app.globalData.baseUrl}user/update`,
      method: 'POST',
      data: {
        user_id: userId,
        avatar: avatarUrl
      },
      success: (res) => {
        wx.hideLoading();
        if (res.data.code === 200) {
          // 更新缓存 & 全局
          const newUserInfo = {
            ...app.globalData.userInfo,
            avatar: avatarUrl,
            userAvatar: avatarUrl
          };
          app.globalData.userInfo = newUserInfo;
          wx.setStorageSync('userInfo', newUserInfo);

          this.setData({ userInfo: newUserInfo });
          wx.showToast({ title: '头像修改成功', icon: 'success' });
        } else {
          wx.showToast({ title: '头像保存失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '网络异常', icon: 'none' });
      }
    })
  },

  onInputChange(e) {
    const { key } = e.currentTarget.dataset;
    this.setData({ [`formData.${key}`]: e.detail.value })
  },

  onPwdChange(e) {
    const { key } = e.currentTarget.dataset;
    this.setData({ [`pwdData.${key}`]: e.detail.value })
  },

  // ====================== 保存信息（已修复） ======================
  saveUserInfo() {
    const { username, nickname, phone } = this.data.formData;
    const userId = app.globalData.userInfo.id;

    if (!username && !nickname && !phone) {
      wx.showToast({ title: '至少修改一个字段', icon: 'none' });
      return;
    }
    if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '手机号格式不正确', icon: 'none' });
      return;
    }

    this.setData({ saving: true });

    wx.request({
      url: `${app.globalData.baseUrl}user/update`,
      method: 'POST',
      data: {
        user_id: userId,
        username: username || undefined,
        nickname: nickname || undefined,
        phone: phone || undefined
      },
      success: (res) => {
        this.setData({ saving: false });
        if (res.data.code === 200) {
          const newUserInfo = {
            ...app.globalData.userInfo,
            userName: res.data.data.username,
            nickName: res.data.data.nickname,
            phone: res.data.data.phone
          };
          app.globalData.userInfo = newUserInfo;
          wx.setStorageSync('userInfo', newUserInfo);
          wx.showToast({ title: '修改成功', icon: 'success' });
        } else {
          wx.showToast({ title: res.data.msg || '修改失败', icon: 'none' });
        }
      },
      fail: () => {
        this.setData({ saving: false });
        wx.showToast({ title: '网络错误', icon: 'none' });
      }
    })
  },

  // ====================== 修改密码（已修复） ======================
  changePassword() {
    const { oldPwd, newPwd, confirmPwd } = this.data.pwdData;
    const userId = app.globalData.userInfo.id;

    if (!oldPwd) return wx.showToast({ title: '请输入原密码', icon: 'none' });
    if (!newPwd) return wx.showToast({ title: '请输入新密码', icon: 'none' });
    if (newPwd.length < 6 || newPwd.length > 20) return wx.showToast({ title: '密码6-20位', icon: 'none' });
    if (newPwd !== confirmPwd) return wx.showToast({ title: '两次密码不一致', icon: 'none' });

    this.setData({ pwdChanging: true });

    wx.request({
      url: `${app.globalData.baseUrl}user/change-pwd`,
      method: 'POST',
      data: { user_id: userId, old_pwd: oldPwd, new_pwd: newPwd },
      success: (res) => {
        this.setData({ pwdChanging: false });
        if (res.data.code === 200) {
          this.setData({
            pwdData: { oldPwd: '', newPwd: '', confirmPwd: '' }
          });
          wx.showToast({
            title: '密码修改成功', icon: 'success',
            success: () => {
              // 清理缓存并退出
              wx.clearStorageSync();
              app.globalData.userInfo = {};
              app.globalData.isLogin = false;
              setTimeout(() => wx.navigateBack(), 1500);
            }
          });
        } else {
          wx.showToast({ title: res.data.msg || '修改失败', icon: 'none' });
        }
      },
      fail: () => {
        this.setData({ pwdChanging: false });
        wx.showToast({ title: '网络异常', icon: 'none' });
      }
    })
  }
});