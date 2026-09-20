const app = getApp();

Page({
  data: {
    systemCategories: [],    // 系统分类列表
    customCategories: [],    // 自定义分类列表
    loading: false,          // 页面加载状态
    // 批量操作相关
    isEditMode: false,       // 是否开启批量操作模式
    showBatchBar: false,     // 是否显示批量操作栏
    selectedIds: [],         // 选中的分类ID数组
    // 表单弹窗相关
    showFormModal: false,    // 是否显示表单弹窗
    isEdit: false,           // 是否为编辑模式
    formData: {              // 表单数据
      id: '',
      name: '',
      description: '',
      sort: 0
    },
    formLoading: false,      // 表单提交加载状态
    // 删除弹窗相关
    showDeleteModal: false,  // 是否显示删除弹窗
    deleteLoading: false     // 删除操作加载状态
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
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

    // 加载分类列表
    this.loadCategoryList();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 核心：每次显示页面都刷新分类列表（从新增/编辑弹窗关闭后、或返回页面时触发）
    if (app.globalData.isLogin) { // 已登录才刷新
      this.loadCategoryList();
    }
  },

  /**
   * 加载分类列表
   */
  loadCategoryList() {
    this.setData({ loading: true });

    // 先获取系统分类
    wx.request({
      url: `${app.globalData.baseUrl}category/list`,
      method: 'GET',
      data: {
        user_id: app.globalData.userInfo.id,
        type: 0
      },
      success: (res) => {
        if (res.data.code === 200) {
          this.setData({
            systemCategories: res.data.data || []
          });
        }

        // 再获取自定义分类
        this.loadCustomCategories();
      },
      fail: () => {
        this.setData({ loading: false });
        wx.showToast({
          title: '加载系统分类失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 加载自定义分类
   */
  loadCustomCategories() {
    wx.request({
      url: `${app.globalData.baseUrl}category/list`,
      method: 'GET',
      data: {
        user_id: app.globalData.userInfo.id,
        type: 1
      },
      success: (res) => {
        this.setData({ loading: false });
        if (res.data.code === 200) {
          // 过滤出仅自定义分类（type=1）
          const customCates = (res.data.data || []).filter(item => item.type === 1);
          this.setData({
            customCategories: customCates
          });
        } else {
          wx.showToast({
            title: res.data.msg || '加载自定义分类失败',
            icon: 'none'
          });
        }
      },
      fail: () => {
        this.setData({ loading: false });
        wx.showToast({
          title: '加载自定义分类失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 切换批量操作模式
   */
  toggleEditMode() {
    const { isEditMode } = this.data;
    // 关闭模式时清空选中状态
    if (isEditMode) {
      this.setData({
        isEditMode: false,
        showBatchBar: false,
        selectedIds: []
      });
    } else {
      this.setData({
        isEditMode: true
      });
    }
  },

  /**
   * 选择/取消选择分类 - 优化数组操作，确保选中状态同步
   */
  selectCategory(e) {
    const { category } = e.currentTarget.dataset;
    let { selectedIds } = this.data;
    // 确保category.id是字符串类型（和数组中一致）
    const cateId = String(category.id);
    let newSelectedIds = [...selectedIds];

    if (newSelectedIds.includes(cateId)) {
      // 取消选择
      newSelectedIds = newSelectedIds.filter(id => id !== cateId);
    } else {
      // 选中
      newSelectedIds.push(cateId);
    }

    // 强制刷新数据，确保视图更新
    this.setData({
      selectedIds: newSelectedIds,
      showBatchBar: newSelectedIds.length > 0
    }, () => {
      // 可选：打印日志，确认选中状态
      console.log('选中的ID列表：', this.data.selectedIds);
    });
  },

  /**
   * 显示新增分类表单
   */
  showAddForm() {
    this.setData({
      showFormModal: true,
      isEdit: false,
      formData: {
        id: '',
        name: '',
        description: '',
        sort: 0
      }
    });
  },

  /**
   * 显示编辑分类表单
   */
  showEditForm(e) {
    // 批量模式下不触发编辑
    if (this.data.isEditMode) return;

    const category = e.currentTarget.dataset.category;
    this.setData({
      showFormModal: true,
      isEdit: true,
      formData: {
        id: category.id,
        name: category.category_name || '',
        description: category.description || '',
        sort: category.sort || 0
      }
    });
  },

  /**
   * 隐藏表单弹窗
   */
  hideFormModal() {
    this.setData({ showFormModal: false });
  },

  /**
   * 表单输入变化
   */
  onFormInput(e) {
    const { key } = e.currentTarget.dataset;
    const { value } = e.detail;
    this.setData({
      [`formData.${key}`]: value
    });
  },

  /**
   * 提交新增/编辑表单
   */
  submitForm() {
    const { isEdit, formData } = this.data;
    const userId = app.globalData.userInfo.id;

    // 基础校验
    if (!formData.name.trim()) {
      wx.showToast({
        title: '分类名称不能为空',
        icon: 'none'
      });
      return;
    }

    this.setData({ formLoading: true });

    if (!isEdit) {
      // 新增分类
      wx.request({
        url: `${app.globalData.baseUrl}category/add`,
        method: 'POST',
        data: {
          user_id: userId,
          name: formData.name.trim(),
          description: formData.description.trim()
        },
        success: (res) => {
          this.setData({ formLoading: false });
          if (res.data.code === 200) {
            wx.showToast({
              title: '创建分类成功',
              icon: 'success'
            });
            this.hideFormModal();
            // 刷新分类列表
            this.loadCategoryList();
          } else {
            wx.showToast({
              title: res.data.msg || '创建分类失败',
              icon: 'none'
            });
          }
        },
        fail: () => {
          this.setData({ formLoading: false });
          wx.showToast({
            title: '网络错误，创建失败',
            icon: 'none'
          });
        }
      });
    } else {
      // 编辑分类
      wx.request({
        url: `${app.globalData.baseUrl}category/update`,
        method: 'POST',
        data: {
          id: formData.id,
          category_name: formData.name.trim(),
          description: formData.description.trim(),
          sort: formData.sort || 0
        },
        success: (res) => {
          this.setData({ formLoading: false });
          if (res.data.code === 200) {
            wx.showToast({
              title: '修改分类成功',
              icon: 'success'
            });
            this.hideFormModal();
            // 刷新分类列表
            this.loadCategoryList();
          } else {
            wx.showToast({
              title: res.data.msg || '修改分类失败',
              icon: 'none'
            });
          }
        },
        fail: () => {
          this.setData({ formLoading: false });
          wx.showToast({
            title: '网络错误，修改失败',
            icon: 'none'
          });
        }
      });
    }
  },

  /**
   * 显示批量删除确认弹窗
   */
  showDeleteModal() {
    this.setData({ showDeleteModal: true });
  },

  /**
   * 隐藏删除弹窗
   */
  hideDeleteModal() {
    this.setData({ showDeleteModal: false });
  },

  /**
   * 确认批量删除分类
   */
  confirmBatchDelete() {
    const { selectedIds } = this.data;
    const userId = app.globalData.userInfo.id;

    // 空选择校验
    if (selectedIds.length === 0) {
      wx.showToast({
        title: '请选择要删除的分类',
        icon: 'none'
      });
      this.hideDeleteModal();
      return;
    }

    this.setData({ deleteLoading: true });

    wx.request({
      url: `${app.globalData.baseUrl}category/delete`,
      method: 'POST',
      data: {
        category_ids: selectedIds,
        user_id: userId
      },
      success: (res) => {
        this.setData({ deleteLoading: false });
        if (res.data.code === 200) {
          wx.showToast({
            title: res.data.msg || '删除分类成功',
            icon: 'success'
          });
          this.hideDeleteModal();
          // 重置批量操作状态
          this.setData({
            isEditMode: false,
            showBatchBar: false,
            selectedIds: []
          });
          // 刷新分类列表
          this.loadCategoryList();
        } else {
          wx.showToast({
            title: res.data.msg || '删除分类失败',
            icon: 'none'
          });
        }
      },
      fail: () => {
        this.setData({ deleteLoading: false });
        wx.showToast({
          title: '网络错误，删除失败',
          icon: 'none'
        });
      }
    });
  }
});