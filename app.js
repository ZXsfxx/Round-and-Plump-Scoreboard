App({
  globalData: {
    score: {
      team1: 0,
      team2: 0
    },
    dailyScores: []
  },
  onLaunch: function() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      try {
        // 不指定环境ID，使用默认环境
        console.log('初始化云开发环境');
        
        wx.cloud.init({
          traceUser: true
        });
        
        console.log('云开发初始化成功');
      } catch (error) {
        console.error('云开发初始化失败:', error);
      }
    }
    
    // 尝试获取云端数据
    this.getCloudData();
  },
  
  // 从云端获取数据
  getCloudData: function() {
    const that = this;
    
    // 获取总分数据
    wx.cloud.database().collection('scores').get().then(res => {
      console.log('获取总分数据成功:', res);
      if (res.data && res.data.length > 0) {
        that.globalData.score = {
          team1: res.data[0].team1,
          team2: res.data[0].team2
        };
      } else {
        console.log('总分数据为空，创建默认数据');
        // 如果没有数据，则创建默认数据
        wx.cloud.database().collection('scores').add({
          data: {
            team1: 0,
            team2: 0,
            updateTime: new Date()
          }
        }).then(res => {
          console.log('创建默认总分数据成功:', res);
        }).catch(err => {
          console.error('创建默认总分数据失败:', err);
        });
      }
    }).catch(err => {
      console.error('获取总分数据失败，详细错误:', err);
      // 检查集合是否存在
      console.log('请确认已在云开发控制台创建"scores"集合');
    });
    
    // 获取每日比分数据
    wx.cloud.database().collection('dailyScores')
      .orderBy('date', 'asc')
      .get().then(res => {
      console.log('获取每日比分数据成功:', res);
      if (res.data) {
        that.globalData.dailyScores = res.data;
      }
    }).catch(err => {
      console.error('获取每日比分数据失败，详细错误:', err);
      // 检查集合是否存在
      console.log('请确认已在云开发控制台创建"dailyScores"集合');
    });
  }
}) 