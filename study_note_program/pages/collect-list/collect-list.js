const app = getApp();

Page({
  data: {
    collectList: [],       // 收藏列表数据
    loading: false,        // 加载状态
    // 分页参数
    pagination: {
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 0,
      hasMore: true
    }
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
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
    // 检查登录状态
    if (!app.globalData.isLogin) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }

    // 加载收藏列表
    this.loadCollectList(true);
  },

  /**
   * 生命周期函数--监听页面显示（核心：返回自动刷新）
   */
  onShow() {
    // 已登录且有收藏列表数据时，刷新列表（避免首次加载重复请求）
    if (app.globalData.isLogin && (this.data.collectList.length > 0 || this.data.pagination.page > 1)) {
      this.loadCollectList(true);
    }
  },

  /**
   * 加载收藏列表
   * @param {boolean} isRefresh 是否刷新（重置分页）
   */
  loadCollectList(isRefresh = false) {
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

    // 构建请求参数
    const params = {
      user_id: app.globalData.userInfo.id,
      page: pageParams.page,
      pageSize: pageParams.pageSize
    };

    wx.request({
      url: `${app.globalData.baseUrl}collect/list`,
      method: 'GET',
      data: params,
      success: (res) => {
        this.setData({ loading: false });
        
        if (res.data.code === 200) {
          const { list, pagination } = res.data.data;
          // 补充默认值，避免字段缺失导致渲染错误
          const formatList = list.map(item => ({
            ...item,
            title: item.title || '无标题',
            content: item.content || '无内容',
            create_time: item.create_time || '未知时间',
            user_id: item.user_id || '', // 作者ID
            nickname: item.nickname || '匿名作者', // 作者昵称
            collect_count: item.collect_count || 0 // 收藏数
          }));
          
          const newCollectList = isRefresh 
            ? formatList 
            : [...this.data.collectList, ...formatList];
          
          this.setData({
            collectList: newCollectList,
            pagination: {
              page: pagination.page,
              pageSize: pagination.pageSize,
              total: pagination.total,
              totalPages: pagination.totalPages,
              hasMore: pagination.hasMore
            }
          });
        } else {
          wx.showToast({
            title: res.data.msg || '加载收藏失败',
            icon: 'none'
          });
        }
      },
      fail: () => {
        this.setData({ loading: false });
        wx.showToast({
          title: '网络错误，加载失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 上拉加载更多
   */
  onReachBottom() {
    if (this.data.pagination.hasMore && !this.data.loading) {
      this.loadCollectList(false);
    }
  },


  /**
   * 跳转到笔记详情页（传递完整参数）
   */
  goToNoteDetail(e) {
    const { noteId, userId, collectCount } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/note-detail/note-detail?noteId=${noteId}&&userId=${userId}&&collectCount=${collectCount}`
    });
  },

  /**
   * 返回上一页
   */
  goBack() {
    wx.navigateBack();
  }
});