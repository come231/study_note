const app = getApp();

Page({
  data: {
    noteId: '',
    authorId: '',
    collectCount: 0,
    noteInfo: {},
    loading: true,
    loadError: false,
    isOwner: false,
    isCollected: false,
    app: app
  },

  onLoad(options) {
    //根据本地缓存设置登录状态
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      app.globalData.userInfo = userInfo;
      app.globalData.isLogin = true;
    }
    // 获取页面参数
    const { noteId, userId, collectCount } = options;
    if (!noteId) {
      wx.showToast({ title: '缺少笔记ID', icon: 'none' });
      this.goBack();
      return;
    }

    this.setData({
      noteId,
      authorId: userId || '',
      collectCount
    }, () => {
      this.loadNoteDetail();
      this.checkCollectStatus();
    });
  },

  onShow() {
    //根据本地缓存设置登录状态
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
    // 核心：从编辑页返回后刷新详情和收藏状态
    if (this.data.noteId) { // 确保已有笔记ID才刷新
      this.reloadDetail();
    }
  },
// 预览图片
previewImage(e) {
  const url = e.currentTarget.dataset.url;
  const urls = this.data.noteInfo.images.map(item => item.url);
  wx.previewImage({ current: url, urls });
},

// 播放音频
playAudio(e) {
  const url = e.currentTarget.dataset.url;
  const index = e.currentTarget.dataset.index;
  const innerAudioContext = this.data.innerAudioContext;

  if (this.data.playingAudioIndex === index) {
    innerAudioContext.stop();
    this.setData({ playingAudioIndex: -1 });
  } else {
    innerAudioContext.stop();
    innerAudioContext.src = url;
    innerAudioContext.play();
    this.setData({ playingAudioIndex: index });
  }
},
  /**
   * 加载笔记详情
   */
  loadNoteDetail() {
    this.setData({ loading: true });
    wx.request({
      url: `${app.globalData.baseUrl}note/detail`,
      method: 'GET',
      data: {
        note_id: this.data.noteId,
        user_id: this.data.authorId
      },
      success: (res) => {
        if (res.data.code === 200) {
          const noteInfo = res.data.data;
          // 判断是否是自己的笔记
          const isOwner = noteInfo.user_id === app.globalData.userInfo.id;
          this.setData({
            noteInfo,
            isOwner,
            loadError: false
          });
        } else {
          this.setData({ loadError: true });
          wx.showToast({ title: res.data.msg || '获取笔记失败', icon: 'none' });
        }
      },
      fail: () => {
        this.setData({ loadError: true });
        wx.showToast({ title: '网络错误，加载失败', icon: 'none' });
      },
      complete: () => {
        this.setData({ loading: false });
      }
    });
  },

  /**
   * 检查收藏状态
   */
  checkCollectStatus() {
    wx.request({
      url: `${app.globalData.baseUrl}collect/check`,
      method: 'GET',
      data: {
        user_id: app.globalData.userInfo.id,
        note_id: this.data.noteId
      },
      success: (res) => {
        if (res.data.code === 200) {
          this.setData({
            isCollected: res.data.data || false
          });
        }
      },
      fail: () => {
        this.setData({ isCollected: false });
      }
    });
  },

  /**
   * 切换收藏/取消收藏
   */
  toggleCollect() {
    if (!app.globalData.isLogin) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    const url = this.data.isCollected
      ? `${app.globalData.baseUrl}collect/cancel`
      : `${app.globalData.baseUrl}collect/add`;

    wx.request({
      url,
      method: 'POST',
      data: {
        user_id: app.globalData.userInfo.id,
        note_id: this.data.noteId
      },
      success: (res) => {
        if (res.data.code === 200) {
          this.setData({
            isCollected: !this.data.isCollected,
            collectCount: this.data.isCollected
              ? this.data.collectCount - 1
              : this.data.collectCount + 1
          });
          wx.showToast({ title: res.data.msg, icon: 'none' });
        } else {
          wx.showToast({ title: res.data.msg, icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '操作失败，请重试', icon: 'none' });
      }
    });
  },

  /**
   * 跳转到编辑页面
   */
  goToEdit() {
    wx.navigateTo({
      url: `/pages/note-edit/note-edit?noteId=${this.data.noteId}&&userId=${this.data.authorId}`
    });
  },

  /**
   * 返回上一页
   */
  goBack() {
    wx.navigateBack({ delta: 1 });
  },

  //重新加载笔记详情
  reloadDetail() {
    this.setData({ loading: true }); // 显示加载状态
    this.loadNoteDetail(); // 重新加载详情
    this.checkCollectStatus(); // 同时刷新收藏状态
  },
});