// 获取全局应用实例
const app = getApp();

Page({
  data: {
    // 登录状态
    isRegister: false,
    // 登录表单
    username: '',
    password: '',
    // 注册表单
    regUsername: '',
    regNickname: '',
    regPassword1: '',
    regPassword2: '',
    // 错误提示
    regUsernameError: '',
    regNicknameError: '',
    pwdError: '',
    // 头像默认值（从全局变量获取）
    avatarUrl: app.globalData.defaultAvatarUrl,
    // 防抖计时器
    usernameTimer: null,
    nicknameTimer: null,
    // 密码显示控制（用password属性，更稳定）
    loginPwdVisible: false,    // 登录密码是否可见（false=隐藏）
    regPwd1Visible: false,     // 注册密码1是否可见
    regPwd2Visible: false,     // 注册密码2是否可见
    // 自动隐藏计时器
    pwdTimer: null
  },

  // 切换到登录
  switchToLogin() {
    this.setData({
      isRegister: false,
      regUsernameError: '',
      regNicknameError: '',
      pwdError: ''
    });
  },

  // 切换到注册
  switchToRegister() {
    this.setData({
      isRegister: true,
      regUsernameError: '',
      regNicknameError: '',
      pwdError: ''
    });
  },

  // 登录-用户名输入
  handleUsernameInput(e) {
    const username = e.detail.value;
    this.setData({ username });
    
    // 输入用户名后请求获取头像
    if (username) {
      this.getAvatarByUsername(username);
    } else {
      this.setData({ avatarUrl: app.globalData.defaultAvatarUrl });
    }
  },

  // 登录-密码输入
  handlePasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  // 注册-用户名输入（实时校验）
  handleRegUsernameInput(e) {
    const regUsername = e.detail.value;
    this.setData({ regUsername });
    
    // 校验用户名格式（仅字母/数字）
    const reg = /^[a-zA-Z0-9]+$/;
    if (regUsername && !reg.test(regUsername)) {
      this.setData({ regUsernameError: '用户名只能包含字母和数字' });
      return;
    } else {
      this.setData({ regUsernameError: '' });
    }

    // 防抖：避免频繁请求接口
    if (this.data.usernameTimer) clearTimeout(this.data.usernameTimer);
    this.setData({
      usernameTimer: setTimeout(() => {
        if (regUsername) {
          this.checkUsername(regUsername);
        }
      }, 500)
    });
  },

  // 注册-昵称输入（实时校验）
  handleRegNicknameInput(e) {
    const regNickname = e.detail.value;
    this.setData({ regNickname });

    // 防抖：避免频繁请求接口
    if (this.data.nicknameTimer) clearTimeout(this.data.nicknameTimer);
    this.setData({
      nicknameTimer: setTimeout(() => {
        if (regNickname) {
          this.checkNickname(regNickname);
        } else {
          this.setData({ regNicknameError: '' });
        }
      }, 500)
    });
  },

  // 注册-密码1输入
  handleRegPassword1Input(e) {
    this.setData({ regPassword1: e.detail.value });
    this.checkPwd();
  },

  // 注册-密码2输入
  handleRegPassword2Input(e) {
    this.setData({ regPassword2: e.detail.value });
    this.checkPwd();
  },

  // 校验两次密码是否一致
  checkPwd() {
    const { regPassword1, regPassword2 } = this.data;
    if (regPassword2 && regPassword1 !== regPassword2) {
      this.setData({ pwdError: '两次输入的密码不一致' });
    } else {
      this.setData({ pwdError: '' });
    }
  },

  // 校验用户名是否可用
  checkUsername(username) {
    wx.request({
      url: `${app.globalData.baseUrl}user/check-username`,
      method: 'GET',
      data: { username },
      dataType: 'json',
      success: (res) => {
        if (res.data.code === 200) {
          if (!res.data.data.isAvailable) {
            this.setData({ regUsernameError: '用户名已存在，请更换' });
          } else {
            this.setData({ regUsernameError: '用户名可用' });
          }
        }
      },
      fail: () => {}
    });
  },

  // 校验昵称是否可用
  checkNickname(nickname) {
    wx.request({
      url: `${app.globalData.baseUrl}user/check-nickname`,
      method: 'GET',
      data: { nickname },
      dataType: 'json',
      success: (res) => {
        if (res.data.code === 200) {
          if (!res.data.data.isAvailable) {
            this.setData({ regNicknameError: '昵称已存在，请更换' });
          } else {
            this.setData({ regNicknameError: '昵称可用' });
          }
        }
      },
      fail: () => {}
    });
  },

  // 根据用户名获取头像
  getAvatarByUsername(username) {
    wx.request({
      url: `${app.globalData.baseUrl}user/profile`,
      method: 'GET',
      data: { username },
      dataType: 'json',
      success: (res) => {
        if (res.data.code === 200 && res.data.data?.avatar) {
          this.setData({ avatarUrl: res.data.data.avatar });
        } else {
          this.setData({ avatarUrl: app.globalData.defaultAvatarUrl });
        }
      },
      fail: () => {
        this.setData({ avatarUrl: app.globalData.defaultAvatarUrl });
        wx.showToast({ title: '获取头像失败', icon: 'none' });
      }
    });
  },

  // 通用密码显示/隐藏（用password属性，稳定）
  togglePwdVisible(e) {
    const type = e.currentTarget.dataset.type;
    // 清除旧计时器
    if (this.data.pwdTimer) clearTimeout(this.data.pwdTimer);

    let visibleKey = '';
    switch(type) {
      case 'login': visibleKey = 'loginPwdVisible'; break;
      case 'reg1': visibleKey = 'regPwd1Visible'; break;
      case 'reg2': visibleKey = 'regPwd2Visible'; break;
      default: return;
    }

    const newVisible = !this.data[visibleKey];
    this.setData({ [visibleKey]: newVisible });

    // 显示密码时，3秒后自动隐藏
    if (newVisible) {
      this.setData({
        pwdTimer: setTimeout(() => {
          this.setData({ [visibleKey]: false });
        }, 3000)
      });
    }
  },

  // 登录提交（核心修改部分）
  handleLogin() {
    const { username, password } = this.data;
    if (!username) { wx.showToast({ title: '请输入用户名', icon: 'none' }); return; }
    if (!password) { wx.showToast({ title: '请输入密码', icon: 'none' }); return; }
     
    wx.showLoading({ title: '登录中...' })
    wx.request({
      url: `${app.globalData.baseUrl}user/login`,
      method: 'POST',
      data: { username, password },
      success: (res) => {
        wx.hideLoading();
        if (res.data.code === 200) {
          // 1. 解析返回数据：后端返回 [用户信息, token对象]
          const [userData, tokenData] = res.data.data;
          // 2. 构建全局用户信息
          const globalUserInfo = {
            id: userData.id,
            userName: userData.username,
            nickName: userData.nickname,
            userAvatar: userData.avatar,
          };  
          console.log(globalUserInfo)

          // 3. 更新全局数据
          app.globalData.userInfo = globalUserInfo;

          console.log(app.globalData.userInfo)
          app.globalData.isLogin = true;

          // 4. 存储用户信息和Token到本地缓存
          wx.setStorageSync('userInfo', globalUserInfo); // 存储用户信息

      
          wx.setStorageSync('tokenInfo', { // 存储Token信息
            accessToken: tokenData.accessToken,
            refreshToken: tokenData.refreshToken,
            expiresIn: tokenData.expiresIn,
            expireTime: Date.now() + tokenData.expiresIn * 1000 // 计算过期时间戳
          });

          // 5. 登录成功提示并跳转
          wx.showToast({ title: '登录成功', icon: 'success' });
          setTimeout(() => {
            wx.switchTab({
              url: '/pages/public-note/public-note',
            })
          }, 1000); // 缩短跳转延迟，提升体验
        } else {
          wx.showToast({ title: res.data.msg || '登录失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '网络错误，请稍后重试', icon: 'none' });
      }
    });
  },

  // 注册提交
  handleRegister() {
    const { regUsername, regNickname, regPassword1, regPassword2, regUsernameError, regNicknameError, pwdError } = this.data;
    if (!regUsername) { wx.showToast({ title: '请输入用户名', icon: 'none' }); return; }
    if (regUsernameError && regUsernameError !== '用户名可用') { wx.showToast({ title: regUsernameError, icon: 'none' }); return; }
    if (!regNickname) { wx.showToast({ title: '请输入昵称', icon: 'none' }); return; }
    if (regNicknameError && regNicknameError !== '昵称可用') { wx.showToast({ title: regNicknameError, icon: 'none' }); return; }
    if (!regPassword1) { wx.showToast({ title: '请输入密码', icon: 'none' }); return; }
    if (pwdError) { wx.showToast({ title: pwdError, icon: 'none' }); return; }

    wx.request({
      url: `${app.globalData.baseUrl}user/register`,
      method: 'POST',
      data: { username: regUsername, nickname: regNickname, password: regPassword1 },
      success: (res) => {
        if (res.data.code === 200) {
          wx.showToast({ title: '注册成功', icon: 'success' });
          // 清空注册表单
          this.setData({
            regUsername: '', regNickname: '', regPassword1: '', regPassword2: '',
            regUsernameError: '', regNicknameError: '', pwdError: '',
            regPwd1Visible: false, regPwd2Visible: false
          });
          this.switchToLogin();
          this.setData({ username: regUsername });
        } else {
          wx.showToast({ title: res.data.msg || '注册失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '网络错误，请稍后重试', icon: 'none' });
      }
    });
  },

  // 页面卸载时清除计时器
  onUnload() {
    if (this.data.pwdTimer) clearTimeout(this.data.pwdTimer);
    if (this.data.usernameTimer) clearTimeout(this.data.usernameTimer);
    if (this.data.nicknameTimer) clearTimeout(this.data.nicknameTimer);
  }
});