const app = getApp();

Page({
  data: {
    isLogin: false,
    noteForm: {
      title: '',
      content: '',
      category_id: '',
      level: 3,
      privacy_type: 1,
      images: [],      // 本地路径，保存时才上传
      audios: [],
      deleteMediaIds: []
    },
    
    categories: [],
    levelOptions: [
      { id: 1, name: '非常重要', class: 'level-very-important' },
      { id: 2, name: '重要', class: 'level-important' },
      { id: 3, name: '一般', class: 'level-normal' }
    ],
    privacyOptions: [
      { id: 1, name: '私有' },
      { id: 2, name: '公开' }
    ],
    
    levelIndex: 2,
    privacyIndex: 0,
    categoryIndex: 0,
    
    submitting: false,
    inputFocus: false,
    playingAudioIndex: -1,
    maxImageCount: 9,
    maxAudioCount: 5,
    innerAudioContext: null,
    recorderManager: null,
    isRecording: false,
    recordTime: 0,
    recordTimer: null,
    recordStarted: false
  },

  onLoad(options) {
    this.initAudioContext();
    this.initRecorderManager();
    this.checkPageLoginStatus();
    if (!this.data.isLogin) return;
    this.checkLoginStatus();
    this.loadCategories();
  },

  onShow(){
    this.checkPageLoginStatus();
    if (!this.data.isLogin) return;
    this.checkLoginStatus();
    this.loadCategories();
  },

  checkPageLoginStatus() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && userInfo.id) {
      this.setData({ isLogin: true });
      return true;
    } else {
      this.setData({ isLogin: false });
      return false;
    }
  },

  goToLogin() {
    wx.switchTab({ url: '/pages/login/login' });
  },

  checkLoginStatus() {
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      wx.showModal({
        title: '提示', content: '请先登录后再创建笔记',
        showCancel: false,
        success: () => wx.switchTab({ url: '/pages/login/login' })
      });
      return false;
    }
    app.globalData.userInfo = {
      id: userInfo.id, nickName: userInfo.nickname,
      userAvatar: userInfo.avatar, userName: userInfo.username
    };
    app.globalData.isLogin = true;
    return true;
  },

  initAudioContext() {
    const innerAudioContext = wx.createInnerAudioContext();
    innerAudioContext.onEnded(() => this.setData({ playingAudioIndex: -1 }));
    innerAudioContext.onError(() => wx.showToast({ title: '音频播放失败', icon: 'none' }));
    this.setData({ innerAudioContext });
  },

  initRecorderManager() {
    const recorderManager = wx.getRecorderManager();
    this.setData({ recorderManager });

    recorderManager.onStart(() => {
      this.setData({ isRecording: true, recordTime: 0, recordStarted: true });
      this.data.recordTimer = setInterval(() => {
        this.setData({ recordTime: this.data.recordTime + 1 });
      }, 1000);
    });

    recorderManager.onStop((res) => {
      clearInterval(this.data.recordTimer);
      this.setData({ isRecording: false, recordStarted: false });

      wx.cloud.uploadFile({
        cloudPath: `note_audio/${Date.now()}-${Math.random()}.mp3`,
        filePath: res.tempFilePath,
        success: (uploadRes) => {
          const duration = this.formatTime(res.duration / 1000);
          const newAudio = { id: '', url: uploadRes.fileID, duration };
          this.setData({ 'noteForm.audios': [...this.data.noteForm.audios, newAudio] });
          wx.showToast({ title: '录音已上传云端', icon: 'success' });
        },
        fail: () => wx.showToast({ title: '录音上传失败', icon: 'none' })
      });
    });

    recorderManager.onError(() => {
      clearInterval(this.data.recordTimer);
      this.setData({ isRecording: false, recordStarted: false });
      wx.showToast({ title: '录音失败', icon: 'none' });
    });
  },

  formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  },

  loadCategories() {
    if (!app.globalData.isLogin) return;
    wx.request({
      url: `${app.globalData.baseUrl}category/list`,
      method: 'GET',
      data: { user_id: app.globalData.userInfo.id, type: 1 },
      success: (res) => {
        if (res.data.code === 200) {
          const categories = res.data.data || [];
          this.setData({
            categories,
            'noteForm.category_id': categories.length > 0 ? categories[0].id : '',
            categoryIndex: 0
          });
        }
      },
      fail: () => wx.showToast({ title: '加载分类失败', icon: 'none' })
    });
  },

  onTitleInput(e) { this.setData({ 'noteForm.title': e.detail.value.trim() }); },
  onContentInput(e) { this.setData({ 'noteForm.content': e.detail.value.trim() }); },
  onInputFocus() { this.setData({ inputFocus: true }); },
  onInputBlur() { this.setData({ inputFocus: false }); },

  onCategoryChange(e) {
    const index = e.detail.value;
    this.setData({ categoryIndex: index, 'noteForm.category_id': this.data.categories[index]?.id || '' });
  },
  onLevelChange(e) {
    const index = e.detail.value;
    this.setData({ levelIndex: index, 'noteForm.level': this.data.levelOptions[index].id });
  },
  onPrivacyChange(e) {
    const index = e.detail.value;
    this.setData({ privacyIndex: index, 'noteForm.privacy_type': this.data.privacyOptions[index].id });
  },

  // ==============================================
  // 【重要修改】选择图片 → 只存本地，不上传云存储
  // ==============================================
  chooseImage() {
    const { images } = this.data.noteForm;
    if (images.length >= 9) {
      return wx.showToast({ title: '最多9张图片', icon: 'none' });
    }

    wx.chooseImage({
      count: 9 - images.length,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const localPaths = res.tempFilePaths;
        const newImgs = localPaths.map(path => ({ id: "", url: path, isLocal: true }));
        this.setData({ 'noteForm.images': [...images, ...newImgs] });
        wx.showToast({ title: '已选择图片，保存时上传云端', icon: 'success' });
      }
    });
  },

  chooseAudio() {
    const { audios } = this.data.noteForm;
    if (audios.length >= 5) {
      return wx.showToast({ title: '最多5条音频', icon: 'none' });
    }
    wx.showActionSheet({
      itemList: ['录制音频', '从本地选择'],
      success: (res) => res.tapIndex === 0 ? this.startRecord() : this.chooseAudioFromLocal()
    });
  },

  startRecord() {
    const { recorderManager } = this.data;
    const options = { duration: 60000, sampleRate: 16000, channels: 1, bitRate: 96000, format: 'mp3' };

    wx.getSetting({
      success: (s) => {
        if (!s.authSetting['scope.record']) {
          wx.authorize({
            scope: 'scope.record',
            success: () => recorderManager.start(options),
            fail: () => wx.showToast({ title: '请开启录音权限', icon: 'none' })
          });
        } else recorderManager.start(options);
      }
    });

    wx.showModal({
      title: '录音中', content: '点击完成结束', confirmText: '完成',
      success: (res) => {
        if (res.confirm && this.data.recordStarted) this.data.recorderManager.stop();
      }
    });
  },

  chooseAudioFromLocal() {
    wx.chooseMessageFile({
      count: 1, type: 'audio',
      success: (res) => {
        const file = res.tempFiles[0];
        wx.cloud.uploadFile({
          cloudPath: `note_audio/${Date.now()}-${Math.random()}.mp3`,
          filePath: file.path,
          success: (up) => {
            const duration = this.formatTime(file.duration || 0);
            const newAudio = { id: '', url: up.fileID, duration };
            this.setData({ 'noteForm.audios': [...this.data.noteForm.audios, newAudio] });
            wx.showToast({ title: '音频已上传', icon: 'success' });
          }
        });
      }
    });
  },

  playAudio(e) {
    const { url, index } = e.currentTarget.dataset;
    const { innerAudioContext, playingAudioIndex } = this.data;

    if (playingAudioIndex === index) {
      innerAudioContext.pause();
      this.setData({ playingAudioIndex: -1 });
    } else {
      innerAudioContext.stop();
      innerAudioContext.src = url;
      innerAudioContext.play();
      this.setData({ playingAudioIndex: index });
    }
  },

  deleteMedia(e) {
    const { type, index, id } = e.currentTarget.dataset;
    const { images, audios, deleteMediaIds } = this.data.noteForm;

    wx.showModal({
      title: '确认删除', confirmColor: '#ef4444',
      success: (res) => {
        if (!res.confirm) return;
        let delIds = deleteMediaIds;
        if (id) delIds.push(id);

        if (type === 'image') {
          images.splice(index, 1);
          this.setData({ 'noteForm.images': images, 'noteForm.deleteMediaIds': delIds });
        } else {
          audios.splice(index, 1);
          this.setData({ 'noteForm.audios': audios, 'noteForm.deleteMediaIds': delIds });
        }
      }
    });
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    const urls = this.data.noteForm.images.map(i => i.url);
    wx.previewImage({ current: url, urls });
  },

  // ==============================================
  // 【核心】提交时 → 统一上传图片到云存储
  // ==============================================
  async submitForm() {
    if (!this.checkLoginStatus()) return;
    const { title, content, category_id, images } = this.data.noteForm;
    if (!title) return wx.showToast({ title: '请输入标题', icon: 'none' });
    if (!content) return wx.showToast({ title: '请输入内容', icon: 'none' });
    if (!category_id) return wx.showToast({ title: '请选择分类', icon: 'none' });

    this.setData({ submitting: true });
    wx.showLoading({ title: '正在保存并上传图片...', mask: true });

    // 上传本地图片
    let finalImages = [];
    for (let img of images) {
      if (img.isLocal) {
        try {
          const upload = await wx.cloud.uploadFile({
            cloudPath: `note_images/${Date.now()}-${Math.random()}.png`,
            filePath: img.url
          });
          finalImages.push({ media_type: 1, media_url: upload.fileID });
        } catch (e) {}
      } else {
        finalImages.push({ media_type: 1, media_url: img.url });
      }
    }

    const audioList = this.data.noteForm.audios.map(a => ({ media_type: 2, media_url: a.url }));
    const mediaList = [...finalImages, ...audioList];

    const formData = {
      user_id: app.globalData.userInfo.id, title, content, category_id,
      level: this.data.noteForm.level,
      privacy_type: this.data.noteForm.privacy_type,
      mediaList
    };

    wx.request({
      url: `${app.globalData.baseUrl}note/add`,
      method: 'POST', data: formData,
      success: (res) => {
        if (res.data.code === 200) {
          wx.showToast({ title: '笔记创建成功', icon: 'success' });
          setTimeout(() => wx.switchTab({ url: '/pages/my-note/my-note' }), 1500);
          this.resetForm();
        } else wx.showToast({ title: res.data.msg || '创建失败', icon: 'none' });
      },
      fail: () => wx.showToast({ title: '网络错误', icon: 'none' }),
      complete: () => {
        wx.hideLoading();
        this.setData({ submitting: false });
      }
    });
  },

  resetForm() {
          this.setData({
            noteForm: {
              title: '', content: '',
              category_id: this.data.categories.length > 0 ? this.data.categories[0].id : '',
              level: 3, privacy_type: 1, images: [], audios: [], deleteMediaIds: []
            },
            levelIndex: 2, privacyIndex: 0, categoryIndex: 0, playingAudioIndex: -1
          });
  },

  onUnload() {
    const { innerAudioContext, recorderManager, recordTimer } = this.data;
    if (innerAudioContext) { innerAudioContext.stop(); innerAudioContext.destroy(); }
    if (recorderManager && this.data.recordStarted) recorderManager.stop();
    if (recordTimer) clearInterval(recordTimer);
  }
});