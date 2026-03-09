const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 静态文件服务（如果需要同时托管前端）
app.use(express.static('../dist/build/h5'));

// 引入路由
const calendarRouter = require('./routes/calendar');
const qaRouter = require('./routes/qa');
const recommendRouter = require('./routes/recommend');

// API 路由
app.use('/api/calendar', calendarRouter);
app.use('/api/qa', qaRouter);
app.use('/api/recommend', recommendRouter);

// SPA 路由支持（前端页面刷新不404）
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(__dirname + '/../dist/build/h5/index.html');
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`API 端点:`);
  console.log(`  - 日历: http://localhost:${PORT}/api/calendar`);
  console.log(`  - 问答: http://localhost:${PORT}/api/qa`);
  console.log(`  - 推荐: http://localhost:${PORT}/api/recommend`);
});
