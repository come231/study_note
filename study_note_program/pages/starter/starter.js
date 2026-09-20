Page({
  /**
       * 生命周期函数--监听页面显示
       */
      onShow() {
        // 定时
        setTimeout(() => {
            wx.switchTab({
                url: '/pages/public-note/public-note',
            })
        }, 3000)
    }
  })
     