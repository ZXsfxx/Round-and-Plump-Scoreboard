const app = getApp()

Page({
  data: {
    team1Score: 0,
    team2Score: 0,
    pickerVisible: false,
    currentTeam: '',
    pickerValue: 0,
    pickerRange: Array.from({length: 100}, (_, i) => i),
    dailyScores: [],
    datePickerVisible: false,
    currentDate: '',
    editingIndex: -1,
    editMode: 'add', // 'add' 或 'delete' 或 'search'
    years: Array.from({length: 100}, (_, i) => 2000 + i),
    months: Array.from({length: 12}, (_, i) => i + 1),
    days: Array.from({length: 31}, (_, i) => i + 1),
    dateValue: [0, 0, 0],
    existingDates: [], // 存储已添加的日期
    searchableYears: [], // 可搜索的年份
    searchableMonths: [], // 可搜索的月份
    searchableDays: [], // 可搜索的日期
    scrollTop: 0, // 新增：scroll-view 的滚动位置
    calendarVisible: false, // 新增：控制日历显示
    noteEditorVisible: false,
    noteContent: '',
    isSaving: false, // 添加保存状态
    isLoadingNote: false, // 新增：控制加载状态
    isLoadingCalendar: false,
    isLoadingDate: false,
    // 新增笔记功能相关
    notesList: [],
    activeNoteTab: 'all',
    isEditingNote: false,
    currentNote: {
      id: '',
      title: '',
      blocks: [],
      type: 'text'
    },
    isPreviewingImage: false,
    previewImageIndex: 0,
    currentFocusIndex: 0, // 当前光标所在的文本块索引
  },

  onLoad: function() {
    // 等待云端数据加载完成
    const that = this;
    const timer = setInterval(() => {
      if (app.globalData.dailyScores.length > 0 || app.globalData.score.team1 > 0 || app.globalData.score.team2 > 0) {
        clearInterval(timer);
        that.setData({
          dailyScores: app.globalData.dailyScores,
          currentDate: that.formatDate(new Date())
        });
        that.calculateTotalScore();
      }
    }, 500);

    this.initDatePicker();
    this.loadNotesList(); // 预加载笔记列表
  },

  // 页面显示时刷新数据
  onShow: function() {
    const that = this;
    // 从云端重新获取数据
    this.getCloudData();
    
    // 确保滚动视图回到顶部
    setTimeout(() => {
      if (wx.pageScrollTo) {
        wx.pageScrollTo({
          scrollTop: 0,
          duration: 0
        });
      }
    }, 300);
  },

  // 从云端获取数据
  getCloudData: function() {
    const that = this;
    const db = wx.cloud.database();
    
    // 获取每日比分数据
    db.collection('dailyScores')
      .get().then(res => {
      if (res.data) {
        // 对日期进行排序（按日期从早到晚）
        const sortedScores = res.data.sort((a, b) => {
          return new Date(a.date) - new Date(b.date);
        });
        
        that.setData({
          dailyScores: sortedScores
        });
        that.calculateTotalScore();
      }
    }).catch(err => {
      console.error('获取每日比分数据失败', err);
    });
  },

  initDatePicker: function() {
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    
    this.setData({
      dateValue: [year - 2000, month, day - 1],
      currentDate: this.formatDate(date)
    });
  },

  formatDate: function(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  showPicker: function(e) {
    // 不再允许直接修改总分
    const team = e.currentTarget.dataset.team;
    if (!e.currentTarget.dataset.index && e.currentTarget.dataset.index !== 0) {
      return;
    }
    
    const index = e.currentTarget.dataset.index;
    const currentScore = this.data.dailyScores[index][team];
    
    this.setData({
      pickerVisible: true,
      currentTeam: team,
      pickerValue: currentScore,
      editingIndex: index
    });
  },

  hidePicker: function() {
    this.setData({
      pickerVisible: false
    });
  },

  showDatePicker: function(e) {
    const mode = e.currentTarget.dataset.mode || 'add';
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    
    if (mode === 'search') {
      const existingDates = this.data.dailyScores.map(score => score.date);
      if (existingDates.length === 0) {
        wx.showToast({
          title: '暂无日期可搜索',
          icon: 'none'
        });
        return;
      }

      // 处理搜索模式的日期选项
      const searchableDates = this.getSearchableDates(existingDates);
      this.setData({
        datePickerVisible: true,
        editMode: mode,
        searchableYears: searchableDates.years,
        searchableMonths: searchableDates.months,
        searchableDays: searchableDates.days,
        dateValue: [0, 0, 0],
        currentDate: searchableDates.years[0] + '-' + 
                    searchableDates.months[0].toString().padStart(2, '0') + '-' + 
                    searchableDates.days[0].toString().padStart(2, '0')
      });
    } else {
      this.setData({
        datePickerVisible: true,
        editMode: mode,
        dateValue: [year - 2000, month, day - 1],
        currentDate: this.formatDate(date)
      });
    }
  },

  // 获取可搜索的日期选项
  getSearchableDates: function(existingDates) {
    const dates = existingDates.map(date => {
      const [year, month, day] = date.split('-').map(Number);
      return { year, month, day };
    });

    const years = [...new Set(dates.map(d => d.year))].sort((a, b) => a - b);
    const months = [...new Set(dates.map(d => d.month))].sort((a, b) => a - b);
    const days = [...new Set(dates.map(d => d.day))].sort((a, b) => a - b);

    return { years, months, days };
  },

  onDatePickerChange: function(e) {
    const value = e.detail.value;
    if (this.data.editMode === 'search') {
      const year = this.data.searchableYears[value[0]];
      const month = this.data.searchableMonths[value[1]];
      const day = this.data.searchableDays[value[2]];
      
      this.setData({
        dateValue: value,
        currentDate: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
      });
    } else {
      const year = this.data.years[value[0]];
      const month = this.data.months[value[1]];
      const day = this.data.days[value[2]];
      
      this.setData({
        dateValue: value,
        currentDate: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
      });
    }
  },

  addDailyScore: function() {
    // 检查日期是否已存在
    const dateExists = this.data.dailyScores.some(score => score.date === this.data.currentDate);
    if (dateExists) {
      wx.showToast({
        title: '该日期已存在',
        icon: 'none'
      });
      return;
    }

    const newScore = {
      date: this.data.currentDate,
      team1: 0,
      team2: 0,
      createTime: new Date()
    };
    
    wx.showLoading({
      title: '添加中...',
    });
    
    // 添加到云数据库
    wx.cloud.database().collection('dailyScores').add({
      data: newScore
    }).then(res => {
      // 添加成功后，为新记录添加_id字段
      newScore._id = res._id;
      
      // 添加新日期并按照日期进行排序
      const dailyScores = [...this.data.dailyScores, newScore].sort((a, b) => {
        return new Date(a.date) - new Date(b.date);
      });
      
      // 更新已添加的日期列表
      const existingDates = dailyScores.map(score => score.date);
      
      this.setData({
        dailyScores: dailyScores,
        datePickerVisible: false,
        existingDates: existingDates
      });
      
      app.globalData.dailyScores = dailyScores;
      this.calculateTotalScore();
      
      wx.hideLoading();
      wx.showToast({
        title: '添加成功',
      });
    }).catch(err => {
      console.error('添加日期失败，详细错误:', err);
      wx.hideLoading();
      wx.showToast({
        title: '添加失败: ' + (err.errMsg || JSON.stringify(err)),
        icon: 'none',
        duration: 3000
      });
    });
  },

  showScorePicker: function(e) {
    const { index, team } = e.currentTarget.dataset;
    const currentScore = this.data.dailyScores[index][team];
    
    this.setData({
      pickerVisible: true,
      currentTeam: team,
      pickerValue: currentScore,
      editingIndex: index
    });
  },

  onDailyScoreChange: function(e) {
    const score = e.detail.value;
    const { editingIndex, currentTeam } = this.data;
    
    const dailyScores = [...this.data.dailyScores];
    const item = dailyScores[editingIndex];
    item[currentTeam] = score;
    
    wx.showLoading({
      title: '更新中...',
    });
    
    // 更新云数据库
    wx.cloud.database().collection('dailyScores').doc(item._id).update({
      data: {
        [currentTeam]: parseInt(score),
        updateTime: new Date()
      }
    }).then(res => {
      this.setData({
        dailyScores: dailyScores,
        pickerVisible: false
      });
      
      app.globalData.dailyScores = dailyScores;
      this.calculateTotalScore();
      
      wx.hideLoading();
    }).catch(err => {
      wx.hideLoading();
      wx.showToast({
        title: '更新失败',
        icon: 'none'
      });
      console.error('更新分数失败', err);
    });
  },

  calculateTotalScore: function() {
    let totalTeam1 = 0;
    let totalTeam2 = 0;
    
    this.data.dailyScores.forEach(score => {
      totalTeam1 += parseInt(score.team1) || 0;
      totalTeam2 += parseInt(score.team2) || 0;
    });
    
    this.setData({
      team1Score: totalTeam1,
      team2Score: totalTeam2
    });
    
    const db = wx.cloud.database();
    
    // 获取总分记录
    db.collection('scores').get().then(res => {
      if (res.data && res.data.length > 0) {
        // 更新现有记录
        db.collection('scores').doc(res.data[0]._id).update({
          data: {
            team1: totalTeam1,
            team2: totalTeam2,
            updateTime: new Date()
          }
        }).catch(err => {
          console.error('更新总分失败', err);
        });
      } else {
        // 创建新记录
        db.collection('scores').add({
          data: {
            team1: totalTeam1,
            team2: totalTeam2,
            updateTime: new Date()
          }
        }).catch(err => {
          console.error('创建总分记录失败', err);
        });
      }
    }).catch(err => {
      console.error('获取总分记录失败', err);
    });
    
    // 更新全局数据
    app.globalData.score = {
      team1: totalTeam1,
      team2: totalTeam2
    };
  },

  // 搜索日期并滚动到对应位置
  searchDate: function() {
    const targetDate = this.data.currentDate;
    const index = this.data.dailyScores.findIndex(score => score.date === targetDate);
    
    if (index === -1) {
      wx.showToast({
        title: '未找到该日期',
        icon: 'none'
      });
      return;
    }

    this.setData({
      datePickerVisible: false
    });

    // 计算需要滚动的位置
    const itemHeight = 200; // 每个日期项的大约高度（包含间距）
    const scrollTop = index * itemHeight;

    // 使用 setData 更新 scrollTop
    this.setData({
      scrollTop: scrollTop,
      // 添加高亮效果
      dailyScores: this.data.dailyScores.map((score, idx) => ({
        ...score,
        highlight: idx === index
      }))
    });

    // 1.5秒后移除高亮效果
    setTimeout(() => {
      const dailyScores = this.data.dailyScores.map(score => ({
        ...score,
        highlight: false
      }));
      this.setData({ dailyScores });
    }, 1500);
  },

  hideDatePicker: function() {
    this.setData({
      datePickerVisible: false
    });
  },

  // 显示删除确认对话框
  showDeleteConfirm: function(e) {
    const dateToDelete = e.currentTarget.dataset.date;
    const idToDelete = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '删除确认',
      content: `确定要删除 ${dateToDelete} 的比分记录吗？`,
      confirmText: '删除',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          this.deleteDailyScoreById(idToDelete, dateToDelete);
        }
      }
    });
  },
  
  // 根据ID删除日期比分
  deleteDailyScoreById: function(id, date) {
    if (!id) {
      wx.showToast({
        title: '删除失败：无效的记录ID',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    wx.showLoading({
      title: '删除中...'
    });
    
    // 从云数据库删除
    const db = wx.cloud.database();
    db.collection('dailyScores').doc(id).remove({
      success: res => {
        const dailyScores = this.data.dailyScores.filter(score => score._id !== id);
        // 更新已添加的日期列表
        const existingDates = dailyScores.map(score => score.date);
        
        this.setData({
          dailyScores: dailyScores,
          existingDates: existingDates
        });
        
        app.globalData.dailyScores = dailyScores;
        this.calculateTotalScore();
        
        wx.hideLoading();
        wx.showToast({
          title: '删除成功'
        });
      },
      fail: err => {
        console.error('删除日期失败', err);
        wx.hideLoading();
        wx.showToast({
          title: '没有删除权限，请联系管理员',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 显示日历
  showCalendar: function() {
    this.setData({
      calendarVisible: true,
      isLoadingCalendar: true
    });

    // 延迟一小段时间后关闭加载状态，让用户能看到动画
    setTimeout(() => {
      this.setData({
        isLoadingCalendar: false
      });
    }, 500);
  },

  // 隐藏日历
  hideCalendar: function() {
    this.setData({
      calendarVisible: false,
      isLoadingCalendar: false
    });
  },

  // 修改日历点击事件处理
  onCalendarDayTap: function(e) {
    const { date } = e.detail;
    const index = this.data.dailyScores.findIndex(score => score.date === date);
    
    if (index !== -1) {
      // 计算需要滚动的位置
      const itemHeight = 200; // 每个日期项的大约高度（包含间距）
      const scrollTop = index * itemHeight;

      this.setData({
        calendarVisible: false, // 点击日期后关闭日历
        scrollTop: scrollTop,
        // 添加高亮效果
        dailyScores: this.data.dailyScores.map((score, idx) => ({
          ...score,
          highlight: idx === index
        }))
      });

      // 1.5秒后移除高亮效果
      setTimeout(() => {
        const dailyScores = this.data.dailyScores.map(score => ({
          ...score,
          highlight: false
        }));
        this.setData({ dailyScores });
      }, 1500);
    }
  },

  // 显示笔记编辑器
  showNoteEditor() {
    this.setData({
      noteEditorVisible: true,
      isLoadingNote: true
    });
    
    // 加载笔记列表
    this.loadNotesList();
    
    // 短暂延迟后隐藏加载状态
    setTimeout(() => {
      this.setData({
        isLoadingNote: false
      });
    }, 500);
  },

  // 隐藏笔记编辑器
  hideNoteEditor() {
    this.setData({
      noteEditorVisible: false,
      isEditingNote: false,
      isLoadingNote: false,
      isSaving: false
    });
  },

  // 处理笔记内容变化
  onNoteChange(e) {
    this.setData({
      'currentNote.content': e.detail.value
    });
  },

  // 保存笔记
  saveNote() {
    if (this.data.isSaving) return;
    
    const { id, title, blocks } = this.data.currentNote;
    
    // 检查是否有内容
    const hasContent = blocks.some(block => 
      (block.type === 'text' && block.content.trim()) || 
      block.type === 'image'
    );
    
    if (!hasContent) {
      wx.showToast({
        title: '内容不能为空',
        icon: 'none'
      });
      return;
    }
    
    this.setData({
      isSaving: true
    });
    
    const db = wx.cloud.database();
    const now = new Date();
    const noteData = {
      title: title || '',
      blocks: blocks,
      type: blocks.some(block => block.type === 'image') ? 'photo' : 'text',
      updateTime: now
    };
    
    if (id) {
      db.collection('notes').doc(id).update({
        data: noteData,
        success: () => {
          this.saveSuccess(now);
        },
        fail: (err) => {
          this.saveFail(err);
        }
      });
    } else {
      noteData.createTime = now;
      db.collection('notes').add({
        data: noteData,
        success: () => {
          this.saveSuccess(now);
        },
        fail: (err) => {
          this.saveFail(err);
        }
      });
    }
  },
  
  // 保存成功
  saveSuccess(updateTime) {
    this.setData({
      isSaving: false,
      isEditingNote: false
    });
    
    wx.showToast({
      title: '保存成功',
      icon: 'success',
      duration: 2000
    });
    
    // 重新加载笔记列表，确保时间显示正确
    this.loadNotesList();
  },
  
  // 保存失败
  saveFail(err) {
    console.error('保存笔记失败', err);
    this.setData({
      isSaving: false
    });
    
    wx.showToast({
      title: '保存失败',
      icon: 'none'
    });
  },

  // 预加载笔记列表
  loadNotesList() {
    const db = wx.cloud.database();
    db.collection('notes').orderBy('updateTime', 'desc').get({
      success: (res) => {
        if (res.data && res.data.length > 0) {
          const notesList = res.data.map(note => {
            const createTime = this.formatTime(note.createTime);
            const updateTime = this.formatTime(note.updateTime);
            
            // 处理旧格式的笔记数据
            let blocks = note.blocks;
            if (!blocks) {
              blocks = [];
              if (note.content) {
                blocks.push({
                  type: 'text',
                  content: note.content
                });
              }
              if (note.images && note.images.length > 0) {
                note.images.forEach(img => {
                  blocks.push({
                    type: 'image',
                    content: img
                  });
                });
              }
            }

            // 计算图片相关信息
            const imageBlocks = blocks.filter(block => block.type === 'image');
            const firstImageIndex = blocks.findIndex(block => block.type === 'image');
            const remainingImages = firstImageIndex !== -1 ? imageBlocks.length - 1 : 0;
            
            return {
              id: note._id,
              title: note.title || '无标题笔记',
              blocks: blocks,
              createTime: createTime,
              updateTime: updateTime,
              type: note.type || 'text',
              firstImageIndex: firstImageIndex,
              remainingImages: remainingImages
            };
          });
          
          this.setData({
            notesList: notesList
          });
        } else {
          this.setData({
            notesList: []
          });
        }
      },
      fail: (err) => {
        console.error('加载笔记列表失败', err);
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
      }
    });
  },

  formatTime(date) {
    date = new Date(date);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  },

  // 切换笔记标签
  switchNoteTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      activeNoteTab: tab
    });
    
    // 根据标签筛选笔记
    this.filterNotesByTab(tab);
  },
  
  // 根据标签筛选笔记
  filterNotesByTab(tab) {
    const db = wx.cloud.database();
    let query = db.collection('notes');
    
    if (tab !== 'all') {
      query = query.where({
        type: tab
      });
    }
    
    this.setData({
      isLoadingNote: true
    });
    
    query.orderBy('updateTime', 'desc').get({
      success: (res) => {
        if (res.data && res.data.length > 0) {
          const notesList = res.data.map(note => {
            const createTime = this.formatTime(note.createTime);
            const updateTime = this.formatTime(note.updateTime);
            
            // 处理旧格式的笔记数据
            let blocks = note.blocks;
            if (!blocks) {
              blocks = [];
              if (note.content) {
                blocks.push({
                  type: 'text',
                  content: note.content
                });
              }
              if (note.images && note.images.length > 0) {
                note.images.forEach(img => {
                  blocks.push({
                    type: 'image',
                    content: img
                  });
                });
              }
            }

            // 计算图片相关信息
            const imageBlocks = blocks.filter(block => block.type === 'image');
            const firstImageIndex = blocks.findIndex(block => block.type === 'image');
            const remainingImages = firstImageIndex !== -1 ? imageBlocks.length - 1 : 0;
            
            return {
              id: note._id,
              title: note.title || '无标题笔记',
              blocks: blocks,
              createTime: createTime,
              updateTime: updateTime,
              type: note.type || 'text',
              firstImageIndex: firstImageIndex,
              remainingImages: remainingImages
            };
          });
          
          this.setData({
            notesList: notesList,
            isLoadingNote: false
          });
        } else {
          this.setData({
            notesList: [],
            isLoadingNote: false
          });
        }
      },
      fail: (err) => {
        console.error('筛选笔记失败', err);
        this.setData({
          isLoadingNote: false
        });
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
      }
    });
  },

  // 创建新笔记
  createNewNote() {
    this.setData({
      isEditingNote: true,
      currentNote: {
        id: '',
        title: '',
        blocks: [{
          type: 'text',
          content: ''
        }],
        type: 'text'
      }
    });
  },

  // 编辑现有笔记
  editNote(e) {
    const noteId = e.currentTarget.dataset.id;
    const note = this.data.notesList.find(item => item.id === noteId);
    
    if (note) {
      // 确保blocks数组存在且有效
      const blocks = note.blocks && note.blocks.length > 0 ? 
        note.blocks : 
        [{
          type: 'text',
          content: ''
        }];

      this.setData({
        isEditingNote: true,
        currentNote: {
          id: note.id,
          title: note.title,
          blocks: blocks,
          type: note.type
        }
      });
    }
  },

  // 取消编辑
  cancelEdit() {
    this.setData({
      isEditingNote: false
    });
  },

  // 标题输入变化
  onNoteTitleChange(e) {
    this.setData({
      'currentNote.title': e.detail.value
    });
  },

  // 阻止事件冒泡
  stopPropagation(e) {
    // 阻止事件冒泡
  },

  // 显示删除笔记确认对话框
  showDeleteNoteConfirm: function(e) {
    const noteId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除笔记',
      content: '确定要删除这条笔记吗？',
      confirmText: '删除',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          this.deleteNote(noteId);
        }
      }
    });
  },

  // 删除笔记
  deleteNote: function(noteId) {
    wx.showLoading({
      title: '删除中...',
    });

    const db = wx.cloud.database();
    db.collection('notes').doc(noteId).remove({
      success: () => {
        wx.hideLoading();
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        });
        // 重新加载笔记列表
        this.loadNotesList();
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({
          title: '删除失败',
          icon: 'error'
        });
        console.error('删除笔记失败：', err);
      }
    });
  },

  // 处理文本块获取焦点
  onTextBlockFocus(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      currentFocusIndex: index
    });
  },

  // 选择并上传图片
  chooseImage() {
    wx.chooseImage({
      count: 9,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePaths = res.tempFilePaths;
        this.uploadImagesAtCursor(tempFilePaths);
      }
    });
  },

  // 在光标位置上传图片
  uploadImagesAtCursor(tempFilePaths) {
    wx.showLoading({
      title: '上传中...',
    });

    const uploadTasks = tempFilePaths.map(filePath => {
      return new Promise((resolve, reject) => {
        const cloudPath = `notes/${Date.now()}-${Math.random().toString(36).substr(2)}.jpg`;
        wx.cloud.uploadFile({
          cloudPath,
          filePath,
          config: {
            env: 'cloud1-1gryghd7fffd2550'
          },
          success: res => {
            // 获取永久访问链接
            wx.cloud.getTempFileURL({
              fileList: [res.fileID],
              config: {
                env: 'cloud1-1gryghd7fffd2550'
              },
              success: urlRes => {
                if (urlRes.fileList && urlRes.fileList[0] && urlRes.fileList[0].tempFileURL) {
                  // 返回永久访问链接而不是 fileID
                  resolve(urlRes.fileList[0].tempFileURL);
                } else {
                  reject(new Error('获取文件访问链接失败'));
                }
              },
              fail: err => {
                reject(err);
              }
            });
          },
          fail: err => {
            reject(err);
          }
        });
      });
    });

    Promise.all(uploadTasks)
      .then(imageUrls => {
        const blocks = [...this.data.currentNote.blocks];
        const insertIndex = this.data.currentFocusIndex;
        const newBlocks = imageUrls.map(url => ({
          type: 'image',
          content: url  // 使用永久访问链接
        }));
        
        // 在光标位置插入图片块
        blocks.splice(insertIndex + 1, 0, ...newBlocks);
        
        // 在最后一个图片后添加一个新的文本块
        blocks.splice(insertIndex + 1 + newBlocks.length, 0, {
          type: 'text',
          content: ''
        });
        
        this.setData({
          'currentNote.blocks': blocks,
          currentFocusIndex: insertIndex + newBlocks.length + 1
        });
        wx.hideLoading();
      })
      .catch(err => {
        wx.hideLoading();
        wx.showToast({
          title: '上传失败',
          icon: 'none'
        });
        console.error('上传图片失败：', err);
      });
  },

  // 预览图片
  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    const imageUrls = this.data.currentNote.blocks
      .filter(block => block.type === 'image')
      .map(block => block.content);
    const current = imageUrls.indexOf(url);
    
    wx.previewImage({
      current: url,
      urls: imageUrls
    });
  },

  // 隐藏图片预览
  hideImagePreview() {
    this.setData({
      isPreviewingImage: false
    });
  },

  // 预览图片滑动切换
  onPreviewSwiperChange(e) {
    this.setData({
      previewImageIndex: e.detail.current
    });
  },

  // 处理文本块输入
  onTextBlockChange(e) {
    const index = e.currentTarget.dataset.index;
    const blocks = [...this.data.currentNote.blocks];
    blocks[index] = {
      ...blocks[index],
      content: e.detail.value
    };
    
    this.setData({
      'currentNote.blocks': blocks
    });
  },

  // 在指定位置后添加图片
  addImageAfterBlock(e) {
    const index = e.currentTarget.dataset.index;
    wx.chooseImage({
      count: 9,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePaths = res.tempFilePaths;
        this.uploadImagesAsBlocks(tempFilePaths, index);
      }
    });
  },

  // 上传图片并作为块插入
  uploadImagesAsBlocks(tempFilePaths, insertAfterIndex) {
    wx.showLoading({
      title: '上传中...',
    });

    const uploadTasks = tempFilePaths.map(filePath => {
      return new Promise((resolve, reject) => {
        const cloudPath = `notes/${Date.now()}-${Math.random().toString(36).substr(2)}.jpg`;
        wx.cloud.uploadFile({
          cloudPath,
          filePath,
          config: {
            env: 'cloud1-1gryghd7fffd2550'
          },
          success: res => {
            // 获取永久访问链接
            wx.cloud.getTempFileURL({
              fileList: [res.fileID],
              config: {
                env: 'cloud1-1gryghd7fffd2550'
              },
              success: urlRes => {
                if (urlRes.fileList && urlRes.fileList[0] && urlRes.fileList[0].tempFileURL) {
                  // 返回永久访问链接而不是 fileID
                  resolve(urlRes.fileList[0].tempFileURL);
                } else {
                  reject(new Error('获取文件访问链接失败'));
                }
              },
              fail: err => {
                reject(err);
              }
            });
          },
          fail: err => {
            reject(err);
          }
        });
      });
    });

    Promise.all(uploadTasks)
      .then(imageUrls => {
        const blocks = [...this.data.currentNote.blocks];
        const newBlocks = imageUrls.map(url => ({
          type: 'image',
          content: url  // 使用永久访问链接
        }));
        
        // 在指定位置后插入图片块
        blocks.splice(insertAfterIndex + 1, 0, ...newBlocks);
        // 在最后一个图片后添加一个新的文本块
        blocks.splice(insertAfterIndex + 1 + newBlocks.length, 0, {
          type: 'text',
          content: ''
        });
        
        this.setData({
          'currentNote.blocks': blocks
        });
        wx.hideLoading();
      })
      .catch(err => {
        wx.hideLoading();
        wx.showToast({
          title: '上传失败',
          icon: 'none'
        });
        console.error('上传图片失败：', err);
      });
  },

  // 删除块
  deleteBlock(e) {
    const index = e.currentTarget.dataset.index;
    const blocks = [...this.data.currentNote.blocks];
    const block = blocks[index];
    
    // 如果是图片块，需要从云存储中删除
    if (block.type === 'image') {
      wx.cloud.deleteFile({
        fileList: [block.content]
      });
    }
    
    blocks.splice(index, 1);
    
    // 确保至少有一个文本块
    if (blocks.length === 0) {
      blocks.push({
        type: 'text',
        content: ''
      });
    }
    
    this.setData({
      'currentNote.blocks': blocks
    });
  },
}) 