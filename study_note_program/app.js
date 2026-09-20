App({
  // 全局初始化
  onLaunch() {
      if (!wx.cloud) {
        console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      } else {
        wx.cloud.init({
          env: 'cloud1-5gte0odu8009ca25', // 替换为刚才复制的环境ID
          traceUser: true
        });
      }
  },

  globalData: {
    userInfo: {
      id: '1', 
      userName: '',
      nickName: '',
      userAvatar: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0',
    },
    tokenInfo: {}, // 新增：存储Token信息
    baseUrl: "http://localhost:3000/api/",
    isLogin: false,
    defaultAvatarUrl: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'
  }
})