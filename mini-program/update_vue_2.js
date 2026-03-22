const fs = require('fs');

const rawData = fs.readFileSync('/Users/zhugehao/Documents/pregnancy_calendar_full.json', 'utf8');
const weeksData = JSON.parse(rawData);

const mockDataArray = weeksData.map(week => {
  let summary = `本周宝宝像一颗${week.baby_size}。`;
  if (week.week === 1) summary = "孕期从末次月经的第一天开始计算。此时你的身体正在为可能到来的受精卵做准备。";
  else if (week.week === 4) summary = "这是一个神奇的时刻！受精卵成功着床，你真正意义上怀孕了！小生命开始扎根。";
  else if (week.week === 12) summary = "进入舒适的孕中期前夕，最重要的NT检查千万不要错过哦！";
  else if (week.week === 24) summary = "宝宝达到了存活临界点，令人期待的糖耐量测试也提上日程了。";
  else if (week.week === 37) summary = "足月啦！随时可能分娩，保持心态平和，随时准备迎接宝宝。";
  else if (week.week === 40) summary = "预产期到了！一切准备就绪，宝宝会在最好的时机与你相见。";

  let emoji = '🌱';
  const size = week.baby_size || '';
  if (size.includes('芝麻')) emoji = '🩸';
  else if (size.includes('绿豆')) emoji = '🟢';
  else if (size.includes('芸豆')) emoji = '🫘';
  else if (size.includes('蓝莓')) emoji = '🫐';
  else if (size.includes('草莓')) emoji = '🍓';
  else if (size.includes('覆盆子') || size.includes('葡萄')) emoji = '🍇';
  else if (size.includes('金橘')) emoji = '🍊';
  else if (size.includes('无花果')) emoji = '🌰';
  else if (size.includes('李子')) emoji = '🍑';
  else if (size.includes('豌豆')) emoji = '🫛';
  else if (size.includes('柠檬')) emoji = '🍋';
  else if (size.includes('苹果')) emoji = '🍎';
  else if (size.includes('牛油果')) emoji = '🥑';
  else if (size.includes('梨')) emoji = '🍐';
  else if (size.includes('甜椒')) emoji = '🫑';
  else if (size.includes('芒果')) emoji = '🥭';
  else if (size.includes('香蕉')) emoji = '🍌';
  else if (size.includes('胡萝卜')) emoji = '🥕';
  else if (size.includes('玉米')) emoji = '🌽';
  else if (size.includes('花椰菜')) emoji = '🥦';
  else if (size.includes('生菜')) emoji = '🥬';
  else if (size.includes('茄子')) emoji = '🍆';
  else if (size.includes('南瓜')) emoji = '🎃';
  else if (size.includes('大白菜')) emoji = '🥬';
  else if (size.includes('椰子')) emoji = '🥥';
  else if (size.includes('哈密瓜') || size.includes('木瓜') || size.includes('蜜瓜')) emoji = '🍈';
  else if (size.includes('菠萝')) emoji = '🍍';
  else if (size.includes('西瓜')) emoji = '🍉';

  return {
    week: week.week,
    title: `孕第${week.week}周`,
    summary,
    babySizeEmoji: emoji,
    babySizeText: week.baby_size_cm ? `约 ${week.baby_size_cm} cm` : '未知大小',
    babyWeight: week.baby_weight_g ? `约 ${week.baby_weight_g} g` : '尚未成型',
    content: {
      baby: week.baby_development ? week.baby_development.join('\n') : '',
      mom: week.body ? week.body.join('\n') : '',
      tips: [...(week.nutrition || []), ...(week.safety || [])],
      todo: [
        ...(week.checkup || []).map(c => ({ type: 'checkup', title: '产检与注意事项', desc: c })),
        ...(week.life_preparation || []).map(l => ({ type: 'action', title: '生活准备', desc: l }))
      ]
    }
  };
});

fs.writeFileSync('/Users/zhugehao/muying-ai-app/mini-program/src/pages/calendar/mockData.json', JSON.stringify(mockDataArray, null, 2));
console.log('Mock JSON created successfully!');
