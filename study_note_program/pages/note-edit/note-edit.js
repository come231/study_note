const app = getApp();

Page({
  data: {
    isEdit: false,
    loading: false,
    inputFocus: false,
    playingAudioIndex: -1,
    maxImageCount: 9,
    maxAudioCount: 5,
    noteInfo: {
      note_id: '',
      user_id: '',
      title: '',
      content: '',
      category_id: '',
      level: '',
      privacy_type: '',
      update_time:'',
      images: [],       // 本地临时图片
      audios: [],       // 本地临时音频
      deleteMediaIds: [], // 要删除的云端媒体ID
      deleteCloudFiles: [] // 【新增】要删除的云端fileID
    },
    categoryList: [],
    categoryIndex: 0,
    levelList: [
      { id: 3, name: '一般', class: 'level-normal' },
      { id: 2, name: '重要', class: 'level-important' },
      { id: 1, name: '非常重要', class: 'level-very-important' }
    ],
    levelIndex: 0,
    privacyList: [
      { id: 0, name: '公开' },
      { id: 1, name: '私有' }
    ],
    privacyIndex: 1,
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
    
    const { noteId, userId } = options;
    const globalUserId = app.globalData.userInfo?.id || app.globalData.userInfo?.user_id;
    const currentUserId = userId || globalUserId;
  
    if (!currentUserId) {
      wx.showToast({ title: '用户未登录', icon: 'none', duration: 1500 });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
  
    this.setData({
      'noteInfo.user_id': currentUserId
    });
  
    this.getCategoryList().then(() => {
      if (noteId) {
        this.setData({
          isEdit: true,
          'noteInfo.note_id': noteId
        });
        this.getNoteDetail();
      } else {
        this.setData({
          'noteInfo.level': this.data.levelList[0].id,
          'noteInfo.privacy_type': this.data.privacyList[1].id,
          'noteInfo.category_id': this.data.categoryList.length > 0 ? this.data.categoryList[0].id : ''
        });
      }
    });
  },

  initAudioContext() {
    const innerAudioContext = wx.createInnerAudioContext();
    innerAudioContext.onEnded(() => {
      this.setData({ playingAudioIndex: -1 });
    });
    innerAudioContext.onError((err) => {
      wx.showToast({ title: '音频播放失败', icon: 'none' });
      console.error('音频播放错误：', err);
    });
    this.setData({ innerAudioContext });
  },

  initRecorderManager() {
    const recorderManager = wx.getRecorderManager();
    this.setData({ recorderManager });

    recorderManager.onStart(() => {
      this.setData({ 
        isRecording: true, 
        recordTime: 0,
        recordStarted: true
      });
      this.data.recordTimer = setInterval(() => {
        this.setData({
          recordTime: this.data.recordTime + 1
        });
      }, 1000);
    });

    // 录音结束 → 只存本地，不自动上传
    recorderManager.onStop((res) => {
      clearInterval(this.data.recordTimer);
      this.setData({ 
        isRecording: false, 
        recordTime: 0,
        recordStarted: false 
      });

      const duration = this.formatTime(res.duration / 1000);
      const newAudio = {
        id: '',
        url: res.tempFilePath,
        duration: duration,
        isLocal: true
      };
      this.setData({
        'noteInfo.audios': [...this.data.noteInfo.audios, newAudio]
      });
      wx.showToast({ title: '录音成功，保存时上传', icon: 'success' });
    });

    recorderManager.onError((err) => {
      clearInterval(this.data.recordTimer);
      this.setData({ 
        isRecording: false, 
        recordTime: 0,
        recordStarted: false
      });
      wx.showToast({ title: '录音失败', icon: 'none' });
    });
  },

  formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  },

  getNoteDetail() {
    const { note_id, user_id } = this.data.noteInfo;
    wx.showLoading({ title: '加载中...', mask: true });

    wx.request({
      url: `${app.globalData.baseUrl}note/detail`,
      method: 'GET',
      data: { note_id, user_id },
      success: (res) => {
        wx.hideLoading();
        if (res.data.code === 200) {
          const note = res.data.data;
          const audios = (note.audios || note.voices || []).map(item => ({
            ...item,
            duration: item.duration ? this.formatTime(item.duration) : '00:00'
          }));
          
          this.setData({
            'noteInfo.title': note.title || '',
            'noteInfo.content': note.content || '',
            'noteInfo.category_id': note.category_id || '',
            'noteInfo.level': note.level || 1,
            'noteInfo.privacy_type': note.privacy_type || 1,
            'noteInfo.update_time': note.update_time,
            'noteInfo.images': note.images || [],
            'noteInfo.audios': audios
          });
          this.matchSelectorIndex();
        } else {
          wx.showToast({ title: res.data.msg || '加载失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '网络异常', icon: 'none' });
      }
    });
  },

  getCategoryList() {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.baseUrl}category/list`,
        method: 'GET',
        data: { user_id: this.data.noteInfo.user_id },
        success: (res) => {
          if (res.data.code === 200) {
            this.setData({ categoryList: res.data.data || [] });
            resolve();
          } else {
            wx.showToast({ title: '分类加载失败', icon: 'none' });
            reject();
          }
        },
        fail: () => {
          wx.showToast({ title: '网络异常', icon: 'none' });
          reject();
        }
      });
    });
  },

  matchSelectorIndex() {
    const { categoryList, levelList, privacyList, noteInfo } = this.data;
    const categoryIndex = categoryList.findIndex(item => item.id == noteInfo.category_id);
    const levelIndex = levelList.findIndex(item => item.id == noteInfo.level);
    const privacyIndex = privacyList.findIndex(item => item.id == noteInfo.privacy_type);

    this.setData({ 
      categoryIndex: categoryIndex === -1 ? 0 : categoryIndex, 
      levelIndex: levelIndex === -1 ? 0 : levelIndex, 
      privacyIndex: privacyIndex === -1 ? 1 : privacyIndex 
    });
  },

  handleTitleInput(e) { this.setData({ 'noteInfo.title': e.detail.value.trim() }); },
  handleContentInput(e) { this.setData({ 'noteInfo.content': e.detail.value.trim() }); },
  handleInputFocus() { this.setData({ inputFocus: true }); },
  handleInputBlur() { this.setData({ inputFocus: false }); },

  handleCategoryChange(e) {
    const idx = e.detail.value;
    this.setData({ categoryIndex: idx, 'noteInfo.category_id': this.data.categoryList[idx]?.id || '' });
  },
  handleLevelChange(e) {
    const idx = e.detail.value;
    this.setData({ levelIndex: idx, 'noteInfo.level': this.data.levelList[idx]?.id || 1 });
  },
  handlePrivacyChange(e) {
    const idx = e.detail.value;
    this.setData({ privacyIndex: idx, 'noteInfo.privacy_type': this.data.privacyList[idx]?.id || 1 });
  },

  // ====================== 选择图片 → 只存本地，不自动上传 ======================
  chooseImage() {
    const { images, maxImageCount } = this.data.noteInfo;
    if (images.length >= maxImageCount) {
      wx.showToast({ title: `最多${maxImageCount}张`, icon: 'none' });
      return;
    }

    wx.chooseImage({
      count: maxImageCount - images.length,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const localPaths = res.tempFilePaths;
        const newImgs = localPaths.map(path => ({
          id: "",
          url: path,
          isLocal: true
        }));
        
        this.setData({
          'noteInfo.images': [...images, ...newImgs]
        });
        wx.showToast({ title: '已选择图片，保存时上传', icon: 'success' });
      }
    });
  },

  chooseAudio() {
    const { audios, maxAudioCount } = this.data.noteInfo;
    if (audios.length >= maxAudioCount) {
      wx.showToast({ title: `最多${maxAudioCount}条`, icon: 'none' });
      return;
    }

    wx.showActionSheet({
      itemList: ['录制音频', '从本地选择'],
      itemColor: '#4361ee',
      success: (res) => {
        res.tapIndex === 0 ? this.startRecord() : this.chooseAudioFromLocal();
      }
    });
  },

  startRecord() {
    const { recorderManager } = this.data;
    const options = { duration:60000, sampleRate:16000, channels:1, bitRate:96000, format:'mp3' };

    wx.getSetting({
      success: (s) => {
        if (!s.authSetting['scope.record']) {
          wx.authorize({
            scope: 'scope.record',
            success: () => recorderManager.start(options),
            fail: () => wx.showToast({ title: '请开启录音权限', icon: 'none' })
          });
        } else {
          recorderManager.start(options);
        }
      }
    });
  },

  // 本地选择音频 → 只存本地
  chooseAudioFromLocal() {
    wx.chooseMessageFile({
      count:1, type:'audio',
      success: (res) => {
        const file = res.tempFiles[0];
        if (!file) return wx.showToast({ title: '选择失败', icon: 'none' });

        const newAudio = {
          id:'',
          url: file.path,
          duration: this.formatTime(file.duration || 0),
          isLocal: true
        };

        this.setData({
          'noteInfo.audios': [...this.data.noteInfo.audios, newAudio]
        });
        wx.showToast({ title: '已选择音频，保存时上传', icon: 'success' });
      }
    });
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    const urls = this.data.noteInfo.images.map(i => i.url);
    wx.previewImage({ current:url, urls });
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

  // ====================== 删除媒体 → 只记录，不立即删云端 ======================
  deleteMedia(e) {
    const { type, index, id } = e.currentTarget.dataset;
    const { images, audios, deleteMediaIds, deleteCloudFiles } = this.data.noteInfo;

    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复',
      confirmColor: '#ef4444',
      success: (res) => {
        if (!res.confirm) return;

        let delIds = deleteMediaIds;
        let delClouds = deleteCloudFiles;
        let targetItem = null;

        if (type === 'image') {
          targetItem = images[index];
          images.splice(index, 1);
          this.setData({ 'noteInfo.images': images });
        } else {
          targetItem = audios[index];
          audios.splice(index, 1);
          this.setData({ 'noteInfo.audios': audios });
        }

        // 记录要删除的数据库ID
        if (id) delIds.push(id);
        // 记录要删除的云端fileID
        if (targetItem && targetItem.url && !targetItem.isLocal) {
          delClouds.push(targetItem.url);
        }

        this.setData({
          'noteInfo.deleteMediaIds': delIds,
          'noteInfo.deleteCloudFiles': delClouds
        });
      }
    });
  },

  handleDelete() {
    if (!this.data.isEdit || !this.data.noteInfo.note_id) {
      return wx.showToast({ title: '无法删除', icon: 'none' });
    }

    wx.showModal({
      title: '确认删除笔记？',
      content: '所有图片/音频都会删除',
      confirmColor: '#ef4444',
      success: (res) => {
        if (!res.confirm) return;
        this.setData({ loading: true });

        wx.request({
          url: `${app.globalData.baseUrl}note/delete`,
          method: 'POST',
          data: {
            note_id: this.data.noteInfo.note_id,
            user_id: this.data.noteInfo.user_id
          },
          success: (res) => {
            if (res.data.code === 200) {
              wx.showToast({ title: '删除成功', icon: 'success' });
              setTimeout(() => wx.navigateBack({ delta:2 }), 1500);
            } else {
              wx.showToast({ title: res.data.msg || '删除失败', icon: 'none' });
            }
          },
          fail: () => wx.showToast({ title: '网络异常', icon: 'none' }),
          complete: () => this.setData({ loading: false })
        });
      }
    });
  },

  // ====================== 【核心】保存时统一上传 + 删除云端 ======================
  async handleSave() {
    const { title, content, category_id, images, audios } = this.data.noteInfo;
    if (!title) return wx.showToast({ title: '请输入标题', icon: 'none' });
    if (!content) return wx.showToast({ title: '请输入内容', icon: 'none' });
    if (!category_id) return wx.showToast({ title: '请选择分类', icon: 'none' });

    this.setData({ loading: true });
    wx.showLoading({ title: '正在保存并同步云端...', mask: true });

    // 1. 批量上传本地图片
    let finalImages = [];
    for (let img of images) {
      if (img.isLocal) {
        try {
          const up = await wx.cloud.uploadFile({
            cloudPath: `note_images/${Date.now()}-${Math.random()}.png`,
            filePath: img.url
          });
          finalImages.push({ media_type: 1, media_url: up.fileID });
        } catch (e) {}
      } else {
        finalImages.push({ media_type: 1, media_url: img.url });
      }
    }

    // 2. 批量上传本地音频
    let finalAudios = [];
    for (let audio of audios) {
      if (audio.isLocal) {
        try {
          const up = await wx.cloud.uploadFile({
            cloudPath: `note_audio/${Date.now()}-${Math.random()}.mp3`,
            filePath: audio.url
          });
          finalAudios.push({ media_type: 2, media_url: up.fileID });
        } catch (e) {}
      } else {
        finalAudios.push({ media_type: 2, media_url: audio.url });
      }
    }

    // 3. 删除云端文件
    const deleteCloudFiles = this.data.noteInfo.deleteCloudFiles || [];
    if (deleteCloudFiles.length > 0) {
      try {
        await wx.cloud.deleteFile({ fileList: deleteCloudFiles });
      } catch (e) {}
    }

    // 4. 提交数据库
    const requestData = {
      note_id: this.data.noteInfo.note_id,
      user_id: this.data.noteInfo.user_id,
      title, content, category_id,
      level: this.data.noteInfo.level,
      privacy_type: this.data.noteInfo.privacy_type,
      addMediaList: [...finalImages, ...finalAudios],
      deleteMediaIds: this.data.noteInfo.deleteMediaIds
    };

    const url = this.data.isEdit 
      ? `${app.globalData.baseUrl}note/update` 
      : `${app.globalData.baseUrl}note/add`;

    wx.request({
      url, method: 'POST', data: requestData,
      success: (res) => {
        if (res.data.code === 200) {
          wx.showToast({ title: this.data.isEdit ? '修改成功' : '创建成功', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 1500);
        } else {
          wx.showToast({ title: res.data.msg || '保存失败', icon: 'none' });
        }
      },
      fail: () => wx.showToast({ title: '网络异常', icon: 'none' }),
      complete: () => {
        wx.hideLoading();
        this.setData({ loading: false });
      }
    });
  },

  navBack() {
    const { innerAudioContext, isRecording, recorderManager, recordStarted, recordTimer } = this.data;
    if (innerAudioContext) innerAudioContext.stop();
    if (isRecording && recordStarted && recorderManager) recorderManager.stop();
    if (recordTimer) clearInterval(recordTimer);
    this.setData({ isRecording: false, recordStarted: false, playingAudioIndex: -1 });
    wx.navigateBack();
  },

  onUnload() {
    const { innerAudioContext, recorderManager, recordTimer, recordStarted, isRecording } = this.data;
    if (innerAudioContext) { innerAudioContext.stop(); innerAudioContext.destroy(); }
    if (isRecording && recordStarted && recorderManager) recorderManager.stop();
    if (recordTimer) clearInterval(recordTimer);
  }
});