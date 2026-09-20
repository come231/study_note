const app = getApp();

Page({
  data: {
// ===== 【新增】登录状态控制 =====
    isLogin: false,


    // 分类数据
    systemCategories: [],
    customCategories: [],
    activeCategory: '', // 当前选中分类ID
    
    // 筛选条件
    levelIndex: 0, // 重要程度索引
    levelOptions: [
      { id: '', name: '全部' },
      { id: 1, name: '非常重要' },
      { id: 2, name: '重要' },
      { id: 3, name: '一般' }
    ],
    privacyIndex: 0, // 隐私类型索引
    privacyOptions: [
      { id: '', name: '全部' },
      { id: 1, name: '私有' },
      { id: 2, name: '公开' }
    ],

    // 笔记列表数据
    noteList: [],
    loading: false,
    // 分页参数
    pagination: {
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 0,
      hasMore: true
    },
    // 新增：搜索相关参数
    searchKeyword: '',   // 搜索关键词
    searchLoading: false, // 搜索加载状态
    
    // ========== 新增批量操作相关参数 ==========
    isSelectMode: false, // 是否进入选择模式
    selectedNoteIds: [], // 选中的笔记ID数组
    showBatchActions: false, // 是否显示批量操作按钮
    // 移动分类弹窗相关
    showMoveModal: false, // 是否显示移动分类弹窗
    moveTargetCategoryId: '', // 选中的目标分类ID
    allCategories: [], // 所有分类（用于移动选择）
    moveLoading: false // 移动加载状态
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // ===== 【新增】先校验登录状态 =====
    this.checkPageLoginStatus();
    if (!this.data.isLogin) return;
    //根据本地缓存设置登录状态
    const userInfo=wx.getStorageSync('userInfo')
    if(userInfo){
      app.globalData.userInfo = {
        id: userInfo.id,
        nickName: userInfo.nickName,
        userAvatar: userInfo.userAvatar,
        userName: userInfo.userName
      };
      app.globalData.isLogin = true;
    }
    // 加载分类数据
    this.loadCategoryList();
    // 加载笔记列表
    this.loadNoteList(true);
  },

  /**
   * 生命周期函数--监听页面显示（核心：返回后自动刷新）
   */
  onShow(){
    // ===== 【新增】每次显示都校验登录 =====
    this.checkPageLoginStatus();
    if (!this.data.isLogin) return;
    //根据本地缓存设置登录状态
    const userInfo=wx.getStorageSync('userInfo')
    if(userInfo){
      app.globalData.userInfo = {
        id: userInfo.id,
        nickName: userInfo.nickName,
        userAvatar: userInfo.userAvatar,
        userName: userInfo.userName
      };
      app.globalData.isLogin = true;
    }
    // 核心修改：页面每次显示时，自动刷新笔记列表和分类列表
    // 场景：从编辑页/详情页/分类页返回后，数据实时更新
    if (app.globalData.isLogin) { // 已登录才刷新，避免未登录请求报错
      this.loadCategoryList(); // 刷新分类（防止分类新增/删除后不同步）
      this.loadNoteList(true); // 刷新笔记列表（重置分页，加载最新数据）
    }
    // 退出选择模式
    this.setData({
      isSelectMode: false,
      selectedNoteIds: [],
      showBatchActions: false
    });
  },
// ===== 【新增】页面登录状态校验 =====
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
// ===== 【新增】去登录 =====
goToLogin() {
  wx.navigateTo({
    url: '/pages/login/login'
  });
},


  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    // 下拉刷新，重置分页
    this.loadNoteList(true, () => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 页面上拉触底事件的处理函数（绑定到scroll-view）
   */
  onReachBottom() {
    // 上拉加载更多
    if (this.data.pagination.hasMore && !this.data.loading && !this.data.isSelectMode) {
      this.loadNoteList(false);
    }
  },

  /**
   * 新增：搜索输入事件
   */
  onSearchInput(e) {
    this.setData({
      searchKeyword: e.detail.value.trim()
    });
  },

  /**
   * 新增：清空搜索关键词
   */
  clearSearch() {
    this.setData({
      searchKeyword: ''
    }, () => {
      // 清空后刷新列表（显示全部）
      this.loadNoteList(true);
    });
  },

  /**
   * 新增：执行搜索
   */
  doSearch() {
    if (!this.data.searchKeyword) {
      wx.showToast({
        title: '请输入标题关键词',
        icon: 'none'
      });
      return;
    }
    // 重置分页，加载搜索结果
    this.setData({
      searchLoading: true
    }, () => {
      this.loadNoteList(true);
    });
  },

  /**
   * 加载分类列表
   */
  loadCategoryList() {
    wx.request({
      url: `${app.globalData.baseUrl}category/list`,
      method: 'GET',
      data: {
        user_id: app.globalData.userInfo.id,
        type: 1 // 获取系统+自定义分类
      },
      success: (res) => {
        if (res.data.code === 200) {
          const categories = res.data.data || [];
          // 分离系统分类和自定义分类
          const systemCategories = categories.filter(item => item.type === 0);
          const customCategories = categories.filter(item => item.type === 1);
          // 合并所有分类（用于移动选择）
          const allCategories = [...systemCategories, ...customCategories];
          
          this.setData({
            systemCategories,
            customCategories,
            allCategories
          });
        }
      },
      fail: () => {
        wx.showToast({ title: '加载分类失败', icon: 'none' });
      }
    });
  },

  /**
   * 加载笔记列表（新增搜索逻辑，不修改原有筛选逻辑）
   * @param {boolean} isRefresh 是否刷新（重置分页）
   * @param {function} callback 回调函数
   */
  loadNoteList(isRefresh = false, callback = null) {
    // 避免重复加载
    if (this.data.loading) return;

    // 重置分页参数
    const pageParams = {
      page: isRefresh ? 1 : this.data.pagination.page + 1,
      pageSize: this.data.pagination.pageSize
    };

    this.setData({
      loading: true
    });

    // 构建筛选参数
    const filterParams = {
      user_id: app.globalData.userInfo.id,
      category_id: this.data.activeCategory,
      level: this.data.levelOptions[this.data.levelIndex].id,
      privacy: this.data.privacyOptions[this.data.privacyIndex].id,
      page: pageParams.page,
      pageSize: pageParams.pageSize
    };

    // 新增：判断是否需要搜索，切换接口
    let requestUrl = `${app.globalData.baseUrl}note/list`;
    if (this.data.searchKeyword) {
      requestUrl = `${app.globalData.baseUrl}note/list/by-title`;
      filterParams.title = this.data.searchKeyword; // 添加搜索关键词
    }

    wx.request({
      url: requestUrl,
      method: 'GET',
      data: filterParams,
      success: (res) => {
        if (res.data.code === 200) {
          const { list, pagination } = res.data.data;
          // 补充收藏数（如果接口返回的list中没有collect_count字段，需要单独请求）
          const noteListWithCollect = list.map(item => ({
            ...item,
            collect_count: item.collect_count || 0
          }));
          
          const newNoteList = isRefresh ? noteListWithCollect : [...this.data.noteList, ...noteListWithCollect];
          
          this.setData({
            noteList: newNoteList,
            pagination: pagination,
            loading: false,
            searchLoading: false // 结束搜索加载
          });
        } else {
          this.setData({ 
            loading: false,
            searchLoading: false 
          });
          wx.showToast({ title: res.data.msg || '加载笔记失败', icon: 'none' });
        }
      },
      fail: () => {
        this.setData({ 
          loading: false,
          searchLoading: false 
        });
        wx.showToast({ title: '网络错误，加载失败', icon: 'none' });
      },
      complete: () => {
        if (typeof callback === 'function') {
          callback();
        }
      }
    });
  },

  // 只修改这一个方法，其余代码完全保留
  changeCategory(e) {
    const categoryId = e.currentTarget.dataset.id || '';
    if (this.data.activeCategory === categoryId) return;

    this.setData({
      activeCategory: categoryId
    }, () => {
      // 刷新笔记列表
      this.loadNoteList(true);
    });
  },

  /**
   * 切换重要程度
   */
  changeLevel(e) {
    const levelIndex = e.detail.value;
    this.setData({
      levelIndex
    }, () => {
      // 刷新笔记列表
      this.loadNoteList(true);
    });
  },

  /**
   * 切换隐私类型
   */
  changePrivacy(e) {
    const privacyIndex = e.detail.value;
    this.setData({
      privacyIndex
    }, () => {
      // 刷新笔记列表
      this.loadNoteList(true);
    });
  },

  /**
   * 跳转到编辑分类页面
   */
  goToEditCategory() {
    wx.navigateTo({
      url: '/pages/category/category'
    });
  },

  /**
   * 跳转到笔记详情页
   */
  goToDetail(e) {
    // 选择模式下不跳转详情
    if (this.data.isSelectMode) return;
    
    const noteId = e.currentTarget.dataset.noteId;
    const userId = e.currentTarget.dataset.userId;
    const collectCount = e.currentTarget.dataset.collectCount;
    wx.navigateTo({
      url: `/pages/note-detail/note-detail?noteId=${noteId}&&userId=${userId}&&collectCount=${collectCount}`
    });
  },

  /**
   * 重新加载数据（供详情页删除后调用）
   */
  reloadData() {
    this.loadNoteList(true);
  },

  // ========== 新增批量操作相关方法 ==========
  /**
   * 切换选择模式
   */
  toggleSelectMode() {
    const isSelectMode = !this.data.isSelectMode;
    this.setData({
      isSelectMode,
      selectedNoteIds: [],
      showBatchActions: false
    });
  },

  /**
   * 选择/取消选择笔记
   */
  selectNote(e) {
    if (!this.data.isSelectMode) return;
    
    const noteId = e.currentTarget.dataset.noteId;
    const selectedNoteIds = [...this.data.selectedNoteIds];
    
    if (selectedNoteIds.includes(noteId)) {
      // 取消选择
      const index = selectedNoteIds.indexOf(noteId);
      selectedNoteIds.splice(index, 1);
    } else {
      // 选中
      selectedNoteIds.push(noteId);
    }
    
    this.setData({
      selectedNoteIds,
      showBatchActions: selectedNoteIds.length > 0
    });
  },

  /**
   * 全选/取消全选
   */
  selectAllNotes() {
    if (!this.data.isSelectMode || this.data.noteList.length === 0) return;
    
    const allNoteIds = this.data.noteList.map(item => item.id);
    const selectedNoteIds = this.data.selectedNoteIds.length === allNoteIds.length 
      ? [] 
      : allNoteIds;
    
    this.setData({
      selectedNoteIds,
      showBatchActions: selectedNoteIds.length > 0
    });
  },

  /**
   * 批量删除笔记
   */
  batchDeleteNotes() {
    if (this.data.selectedNoteIds.length === 0) {
      wx.showToast({ title: '请选择要删除的笔记', icon: 'none' });
      return;
    }
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除选中的${this.data.selectedNoteIds.length}条笔记吗？此操作不可恢复！`,
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          wx.request({
            url: `${app.globalData.baseUrl}note/batch/delete`,
            method: 'POST',
            data: {
              user_id: app.globalData.userInfo.id,
              note_ids: this.data.selectedNoteIds
            },
            success: (res) => {
              if (res.data.code === 200) {
                wx.showToast({
                  title: `成功删除${res.data.data.deletedCount}条笔记`,
                  icon: 'success'
                });
                // 刷新列表并退出选择模式
                this.setData({
                  isSelectMode: false,
                  selectedNoteIds: [],
                  showBatchActions: false
                }, () => {
                  this.loadNoteList(true);
                });
              } else {
                wx.showToast({
                  title: res.data.msg || '删除失败',
                  icon: 'none'
                });
              }
            },
            fail: () => {
              wx.showToast({
                title: '网络错误，删除失败',
                icon: 'none'
              });
            }
          });
        }
      }
    });
  },

  /**
   * 打开移动分类弹窗
   */
  openMoveModal() {
    if (this.data.selectedNoteIds.length === 0) {
      wx.showToast({ title: '请选择要移动的笔记', icon: 'none' });
      return;
    }
    
    this.setData({
      showMoveModal: true,
      moveTargetCategoryId: ''
    });
  },

  /**
   * 选择移动目标分类
   */
  selectMoveCategory(e) {
    this.setData({
      moveTargetCategoryId: e.currentTarget.dataset.id
    });
  },

  /**
   * 确认移动笔记
   */
  confirmMoveNotes() {
    if (!this.data.moveTargetCategoryId) {
      wx.showToast({ title: '请选择目标分类', icon: 'none' });
      return;
    }
    
    this.setData({ moveLoading: true });
    
    wx.request({
      url: `${app.globalData.baseUrl}note/batch/move-category`,
      method: 'POST',
      data: {
        user_id: app.globalData.userInfo.id,
        note_ids: this.data.selectedNoteIds,
        target_category_id: this.data.moveTargetCategoryId
      },
      success: (res) => {
        if (res.data.code === 200) {
          wx.showToast({
            title: `成功移动${res.data.data.movedCount}条笔记`,
            icon: 'success'
          });
          // 关闭弹窗并刷新列表
          this.setData({
            showMoveModal: false,
            moveLoading: false,
            isSelectMode: false,
            selectedNoteIds: [],
            showBatchActions: false
          }, () => {
            this.loadNoteList(true);
          });
        } else {
          this.setData({ moveLoading: false });
          wx.showToast({
            title: res.data.msg || '移动失败',
            icon: 'none'
          });
        }
      },
      fail: () => {
        this.setData({ moveLoading: false });
        wx.showToast({
          title: '网络错误，移动失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 关闭移动分类弹窗
   */
  closeMoveModal() {
    this.setData({
      showMoveModal: false,
      moveTargetCategoryId: '',
      moveLoading: false
    });
  }
});