const express = require('express');
const router = express.Router();

const DISCLAIMER = '本建议仅供参考，不能替代医生诊断。如有不适请及时就医。';

// 预设问答库
const QA_DATABASE = {
  '辅食': {
    content: '根据权威资料整理：\n\n建议6月龄左右开始添加富含铁的高铁米粉，每次一种、观察3天再换。首次少量，逐步加量。\n\n添加顺序建议：高铁米粉 → 蔬菜泥 → 水果泥 → 肉泥 → 蛋黄。\n\n{{DISCLAIMER}}',
    sources: ['丁香妈妈 · 育儿百科', '美国儿科学会育儿百科']
  },
  '发烧': {
    content: '根据权威资料整理：\n\n宝宝发热时的处理建议：\n1. 体温<38.5℃，采用物理降温（温水擦浴）\n2. 体温≥38.5℃，可使用退烧药（布洛芬或对乙酰氨基酚）\n3. 持续发热超过24小时或出现其他症状需就医\n\n{{DISCLAIMER}}',
    sources: ['丁香妈妈 · 育儿百科', '美国儿科学会育儿百科']
  },
  '湿疹': {
    content: '根据权威资料整理：\n\n婴儿湿疹护理建议：\n1. 保持皮肤清洁湿润，每日用温水洗澡\n2. 选择温和的婴儿专用洗护用品\n3. 穿透气性好的纯棉衣物\n4. 避免过度抓挠，必要时使用医生开的药膏\n\n{{DISCLAIMER}}',
    sources: ['丁香妈妈 · 育儿百科']
  },
  '疫苗': {
    content: '根据权威资料整理：\n\n婴幼儿疫苗接种时间表：\n- 出生：乙肝疫苗、卡介苗\n- 1月龄：乙肝疫苗第2针\n- 2月龄：脊髓灰质炎疫苗第1针\n- 3月龄：百白破疫苗第1针\n\n具体请参考当地社区卫生服务中心的接种安排。\n\n{{DISCLAIMER}}',
    sources: ['中国疾控中心', '美国儿科学会育儿百科']
  },
  '补钙': {
    content: '根据权威资料整理：\n\n婴幼儿补钙建议：\n1. 6月龄内母乳喂养的宝宝通常不需要额外补钙\n2. 6月龄后添加辅食，可通过奶制品、豆制品补钙\n3. 每天保证充足的户外活动，促进维生素D合成\n4. 如有缺钙症状，请咨询医生后补充\n\n{{DISCLAIMER}}',
    sources: ['丁香妈妈 · 育儿百科', '中国居民膳食指南']
  }
};

// 默认回答
const DEFAULT_ANSWER = {
  content: '感谢您的提问。根据目前的信息，我建议您可以：\n\n1. 描述宝宝的具体月龄和症状\n2. 关注宝宝的喂养方式和睡眠情况\n3. 如有不适请及时就医\n\n您可以尝试更具体地描述问题，我会尽力为您提供有帮助的建议。\n\n{{DISCLAIMER}}',
  sources: ['丁香妈妈 · 育儿百科', '美国儿科学会育儿百科']
};

/**
 * 发送问题，获取 AI 回答
 * POST /api/qa
 * Body: { question: string, history: [] }
 */
router.post('/', async (req, res) => {
  const { question, history } = req.body;
  
  if (!question) {
    return res.json({
      code: 400,
      message: '请输入问题'
    });
  }
  
  // 简单关键词匹配
  let answer = DEFAULT_ANSWER;
  for (const [keyword, data] of Object.entries(QA_DATABASE)) {
    if (question.includes(keyword)) {
      answer = data;
      break;
    }
  }
  
  // 替换占位符
  const content = answer.content.replace('{{DISCLAIMER}}', DISCLAIMER);
  
  const response = {
    id: `a-${Date.now()}`,
    role: 'assistant',
    content,
    sources: answer.sources,
    disclaimer: true,
    timestamp: Date.now()
  };
  
  res.json({
    code: 0,
    data: response
  });
});

/**
 * 获取预设问题列表
 * GET /api/qa/questions
 */
router.get('/questions', (req, res) => {
  const questions = [
    '宝宝辅食应该什么时候开始添加？',
    '宝宝发烧了怎么办？',
    '婴儿湿疹如何护理？',
    '疫苗接种时间表是怎样的？',
    '宝宝需要补钙吗？'
  ];
  
  res.json({
    code: 0,
    data: questions
  });
});

module.exports = router;
