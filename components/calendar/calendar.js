Component({
  properties: {
    dailyScores: {
      type: Array,
      value: [],
      observer: function(newVal) {
        if (newVal && newVal.length > 0) {
          this.processScores();
        }
      }
    }
  },

  data: {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    days: [],
    weekDays: ['日', '一', '二', '三', '四', '五', '六']
  },

  lifetimes: {
    attached: function() {
      this.initCalendar();
    }
  },

  methods: {
    initCalendar: function() {
      const year = this.data.year;
      const month = this.data.month;
      const days = [];
      
      // 获取当月第一天是星期几
      const firstDay = new Date(year, month - 1, 1).getDay();
      // 获取当月总天数
      const totalDays = new Date(year, month, 0).getDate();
      
      // 填充空白日期
      for (let i = 0; i < firstDay; i++) {
        days.push({
          day: '',
          hasScore: false
        });
      }
      
      // 添加日期
      for (let day = 1; day <= totalDays; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        days.push({
          day: day,
          date: dateStr,
          hasScore: false
        });
      }
      
      this.setData({ days });
      
      // 如果已有比分数据，立即处理
      if (this.properties.dailyScores && this.properties.dailyScores.length > 0) {
        this.processScores();
      }
    },

    processScores: function() {
      const scoreMap = {};
      let maxDiff = 0;

      // 计算每日得分差值并找出最大差值
      this.properties.dailyScores.forEach(score => {
        const diff = score.team1 - score.team2;
        scoreMap[score.date] = diff;
        maxDiff = Math.max(maxDiff, Math.abs(diff));
      });

      // 更新日历数据，添加颜色信息
      const days = this.data.days.map(day => {
        if (!day.date) return day;

        const hasScore = scoreMap.hasOwnProperty(day.date);
        if (!hasScore) {
          return {
            ...day,
            hasScore: false
          };
        }

        const diff = scoreMap[day.date];
        const intensity = maxDiff > 0 ? Math.abs(diff) / maxDiff : 0; // 避免除以0
        const scaledIntensity = Math.sqrt(intensity); // 应用平方根缩放
        
        let color;
        let opacity;
        if (diff > 0) {
          color = '#1e9caf'; // 左方胜出 - 蓝色
          opacity = 0.3 + (scaledIntensity * 0.7); // 胜负透明度
        } else if (diff < 0) {
          color = '#CD5C5C'; // 右方胜出 - 红色
          opacity = 0.3 + (scaledIntensity * 0.7); // 胜负透明度
        } else {
          color = '#FFCA28'; // 平局 - 明亮琥珀色
          opacity = 0.75; // 平局固定透明度
        }
        
        return {
          ...day,
          hasScore: true,
          color,
          opacity // 使用计算好的透明度
        };
      });

      this.setData({ days });
    },

    onDayTap: function(e) {
      const index = e.currentTarget.dataset.index;
      const day = this.data.days[index];
      if (day && day.date) {
        // 检查是否有比分记录
        const hasScore = this.properties.dailyScores.some(score => score.date === day.date);
        if (hasScore) {
          this.triggerEvent('daytap', { date: day.date });
        }
      }
    },

    // 切换到上一个月
    prevMonth: function() {
      let { year, month } = this.data;
      if (month === 1) {
        year--;
        month = 12;
      } else {
        month--;
      }
      this.setData({ year, month }, () => {
        this.initCalendar();
      });
    },

    // 切换到下一个月
    nextMonth: function() {
      let { year, month } = this.data;
      if (month === 12) {
        year++;
        month = 1;
      } else {
        month++;
      }
      this.setData({ year, month }, () => {
        this.initCalendar();
      });
    }
  }
}) 