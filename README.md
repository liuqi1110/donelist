[README.md](https://github.com/user-attachments/files/30499751/README.md)
# Done List 📋

记录每一天的成就感。一个轻量、私密、可装到手机桌面的每日记录 PWA。

## 这是什么

Done List 不是待办清单，而是**"已完成清单"**——每天做了什么，就记一笔。

- 📖 上午读了一本书 → 记下来
- 🎹 下午弹了半小时钢琴 → 记下来
- 👨‍👩‍👧 晚上陪家人聊天 → 记下来

一天结束时回看，满满的成就感 ✨

## 功能

| 功能 | 说明 |
|------|------|
| 📝 快速记录 | 标题 + 快捷时长按钮（15分/30分/1时/2时/自定义），一键录入 |
| 🏷️ 分类管理 | 学习、运动、兴趣爱好、家务… 自定义分类，搭配 emoji 和颜色 |
| 📊 时间统计 | 周/月/年视图，各分类累计时长柱状图 + 日历热力图 |
| 🔥 连续记录 | 自动计算连续记录天数，正向激励不惩罚 |
| ⏰ 每日提醒 | 可选的晚间提醒，别忘了记录今天 |
| 💾 数据备份 | JSON 格式导出/导入，换手机不丢数据 |
| 🔒 隐私安全 | 数据全部存在手机浏览器本地，不上传任何服务器 |
| 📱 装到桌面 | PWA 支持，添加到主屏幕，离线也能用 |
| 📴 离线可用 | Service Worker 缓存，没网也能打开记录 |

## 使用方法

### 手机端

1. 浏览器打开 https://liuqi1110.github.io/donelist
2. 点浏览器菜单 → **"添加到主屏幕"**
3. 桌面出现 Done List 图标，像普通 APP 一样使用

### 电脑端

```bash
git clone https://github.com/liuqi1110/donelist.git
cd donelist
python -m http.server 5000
# 浏览器打开 http://localhost:5000
```

## 技术栈

纯前端 PWA，无需后端服务器：

- **存储** — IndexedDB（浏览器本地数据库）
- **图表** — Chart.js
- **样式** — 莫兰迪配色 + Bootstrap 5
- **离线** — Service Worker
- **PWA** — Web App Manifest

## 许可

MIT License
