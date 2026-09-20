// 获取应用实例
const app = getApp();

Page({
  data: {
    systemCategoryList: [],
    activeCategory: 0,
    activeCategoryName: '全部',
    notes: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    loading: false,
    loadError: false,
    isRequesting: false,
    // 新增搜索相关数据
    searchType: 'title', // 默认标题搜索
    searchKeyword: '',   // 搜索关键词
    searchLoading: false // 搜索加载状态
  },

  onLoad(options) {
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
    this.getSystemCategoryList();
  },

  onShow() {
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
    this.reloadData();
  },

  getSystemCategoryList() {
    wx.request({
      url: `${app.globalData.baseUrl}category/list`,
      method: 'GET',
      data: {
        type: 0,
        user_id: app.globalData.userInfo.id
      },
      success: (res) => {
        if (res.data.code === 200) {
          const systemCateList = res.data.data.filter(item => item.id < 5);
          this.setData({ systemCategoryList: systemCateList }, () => {
            this.loadNoteList();
          });
        } else {
          this.loadNoteList();
        }
      },
      fail: () => {
        this.loadNoteList();
      }
    });
  },

  switchCategory(e) {
    const categoryId = parseInt(e.currentTarget.dataset.categoryId);
    let categoryName = '';

    if (categoryId === 0) {
      categoryName = '全部';
    } else if (categoryId === 999) {
      categoryName = '其它';
    } else {
      const cateItem = this.data.systemCategoryList.find(item => item.id === categoryId);
      categoryName = cateItem ? cateItem.category_name : '未知分类';
    }

    this.setData({
      activeCategory: categoryId,
      activeCategoryName: categoryName,
      page: 1,
      hasMore: true,
      notes: [],
      loadError: false,
      isRequesting: false
    }, () => {
      this.loadNoteList();
    });
  },

  // 新增：切换搜索类型（标题/作者）
  switchSearchType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      searchType: type,
      searchKeyword: '' // 切换类型清空输入
    });
  },

  // 新增：搜索输入
  onSearchInput(e) {
    this.setData({
      searchKeyword: e.detail.value.trim()
    });
  },

  // 新增：清空搜索
  clearSearch() {
    this.setData({
      searchKeyword: ''
    });
  },

  // 新增：执行搜索
  doSearch() {
    if (!this.data.searchKeyword) {
      wx.showToast({
        title: `请输入${this.data.searchType === 'title' ? '标题' : '作者昵称'}关键词`,
        icon: 'none'
      });
      return;
    }
    // 重置分页，重新加载
    this.setData({
      page: 1,
      hasMore: true,
      notes: [],
      searchLoading: true
    }, () => {
      this.loadNoteList();
    });
  },

  loadNoteList() {
    if (this.data.isRequesting || this.data.loading) return;

    this.setData({
      loading: true,
      isRequesting: true
    });

    let requestCateId = this.data.activeCategory;
    if (requestCateId === 999) {
      requestCateId = 5;
    }

    // 构建请求参数和URL
    let requestUrl = `${app.globalData.baseUrl}note/public`;
    const requestData = {
      category_id: requestCateId,
      page: this.data.page,
      pageSize: this.data.pageSize
    };

    // 如果有搜索关键词，切换到对应的搜索接口
    if (this.data.searchKeyword) {
      requestUrl = this.data.searchType === 'title' 
        ? `${app.globalData.baseUrl}note/public/by-title` 
        : `${app.globalData.baseUrl}note/public/by-author`;
      // 添加搜索关键词参数
      requestData[this.data.searchType] = this.data.searchKeyword;
    }

    wx.request({
      url: requestUrl,
      method: 'GET',
      data: requestData,
      success: (res) => {
        if (res.data.code === 200) {
          const { list, pagination } = res.data.data;
          const newNotes = [...this.data.notes, ...list];

          this.setData({
            notes: newNotes,
            hasMore: pagination.hasMore
          });
        } else {
          this.setData({ loadError: true });
        }
      },
      fail: () => {
        this.setData({ loadError: true });
      },
      complete: () => {
        this.setData({
          loading: false,
          isRequesting: false,
          searchLoading: false // 结束搜索加载
        });
      }
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({
        page: this.data.page + 1
      }, () => {
        this.loadNoteList();
      });
    }
  },

  reloadData() {
    this.setData({
      page: 1,
      notes: [],
      hasMore: true,
      loadError: false,
      isRequesting: false
    }, () => {
      this.loadNoteList();
    });
  },

  goToDetail(e) {
    const noteId = e.currentTarget.dataset.noteId;
    const userId = e.currentTarget.dataset.userId;
    const collectCount = e.currentTarget.dataset.collectCount;
    if (!noteId) {
      wx.showToast({ title: '笔记ID不存在', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/note-detail/note-detail?noteId=${noteId}&&userId=${userId}&&collectCount=${collectCount}`
    });
  },

  goToPublish() {
    if(!app.globalData.isLogin){
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 2000
      });
    }else{
      wx.navigateTo({
      url: '/pages/note-edit/note-edit'
    });
    }
  },
});