const express = require('express');
const router = express.Router();

// 默认用户阶段
const DEFAULT_STAGE = {
  mode: 'pregnancy',
  pregnancyWeeks: 12,
};

// 日历数据映射
const CALENDAR_DATA = {
  pregnancy: {
    1: {
      title: '孕1周小贴士',
      summary: '现在你正处于备孕阶段，建议开始服用叶酸，保持健康生活方式。',
      tip: '每天补充400微克叶酸，可以预防胎儿神经管畸形',
      source: '美国儿科学会育儿百科'
    },
    12: {
      title: '孕12周小贴士',
      summary: '本周宝宝约柠檬大小，可开始听胎心。建议补充叶酸、均衡饮食，避免久站。',
      tip: '孕12周是孕早期和孕中期的分界线，胎儿已经形成主要器官',
      source: '美国儿科学会育儿百科'
    },
    24: {
      title: '孕24周小贴士',
      summary: '宝宝开始有听力，可以进行胎教。孕妈要注意补铁，预防妊娠期贫血。',
      tip: '此时宝宝能够感受到外界的声音，可以开始音乐胎教',
      source: '丁香妈妈育儿百科'
    },
    36: {
      title: '孕36周小贴士',
      summary: '宝宝随时可能出生，准备好待产包。密切注意胎动变化。',
      tip: '建议每周产检，关注胎位和宫颈成熟度',
      source: '美国儿科学会育儿百科'
    }
  },
  '0-6m': {
    title: '0-6月龄宝宝护理',
    summary: '坚持母乳喂养，按时接种疫苗。关注宝宝的大运动发展。',
    tip: '这个阶段宝宝主要是吃和睡，注意观察黄疸情况',
    source: '美国儿科学会育儿百科'
  },
  '6-12m': {
    title: '6-12月龄宝宝护理',
    summary: '开始添加辅食，从含铁米粉开始。注意培养宝宝自主进食能力。',
    tip: '辅食添加原则：每次一种、观察3天、由少到多',
    source: '丁香妈妈育儿百科'
  },
  '1-3y': {
      title: '1-3岁幼儿护理',
      summary: '宝宝开始学说话、走路，注重安全防护。培养良好饮食习惯。',
      tip: '这个阶段是语言爆发期，多和宝宝交流',
      source: '美国儿科学会育儿百科'
  }
};

/**
 * 获取日历内容
 * GET /api/calendar?date=2024-01-01
 */
router.get('/', (req, res) => {
  const { date, mode, pregnancyWeeks } = req.query;
  
  // 确定用户阶段
  const userMode = mode || DEFAULT_STAGE.mode;
  const weeks = pregnancyWeeks ? parseInt(pregnancyWeeks) : DEFAULT_STAGE.pregnancyWeeks;
  
  // 获取对应数据
  let calendarData;
  if (userMode === 'pregnancy') {
    // 孕期：按周数获取
    const weekData = CALENDAR_DATA.pregnancy[weeks] || CALENDAR_DATA.pregnancy[12];
    calendarData = {
      date: date || new Date().toISOString().split('T')[0],
      title: `孕${weeks}周小贴士`,
      ...weekData,
      stage: 'pregnancy'
    };
  } else {
    // 育儿阶段
    calendarData = {
      date: date || new Date().toISOString().split('T')[0],
      ...CALENDAR_DATA[userMode] || CALENDAR_DATA['0-6m'],
      stage: userMode
    };
  }
  
  res.json({
    code: 0,
    data: [calendarData]
  });
});

/**
 * 获取当前用户阶段
 * GET /api/calendar/stage
 */
router.get('/stage', (req, res) => {
  res.json({
    code: 0,
    data: DEFAULT_STAGE
  });
});

/**
 * 更新用户阶段
 * POST /api/calendar/stage
 */
router.post('/stage', (req, res) => {
  const { mode, pregnancyWeeks, babyMonths } = req.body;
  
  // 在实际应用中，这里应该存储到数据库
  const stage = {
    mode: mode || 'pregnancy',
    pregnancyWeeks: pregnancyWeeks || 12,
    babyMonths: babyMonths || 0
  };
  
  res.json({
    code: 0,
    data: stage,
    message: '用户阶段已更新'
  });
});

module.exports = router;
