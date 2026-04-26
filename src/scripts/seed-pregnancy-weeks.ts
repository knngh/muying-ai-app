import '../config/env'
import { Prisma, PrismaClient } from '@prisma/client'
import fs from 'fs'

const prisma = new PrismaClient()

async function main() {
  console.log('开始读取孕周数据...')
  
  // 从用户提供的路径读取 JSON 文件
  const rawData = fs.readFileSync('/Users/zhugehao/Documents/pregnancy_calendar_full.json', 'utf8')
  const weeksData = JSON.parse(rawData)
  
  // 确保文章分类存在
  let category = await prisma.category.findUnique({
    where: { slug: 'pregnancy-weeks' }
  })
  
  if (!category) {
    category = await prisma.category.create({
      data: {
        name: '孕周指南',
        slug: 'pregnancy-weeks',
        description: '按周提供权威的孕期发育、母体变化及注意事项',
        isActive: 1,
        sortOrder: 1
      }
    })
  }

  for (const week of weeksData) {
    const slug = `pregnancy-week-${week.week}`
    const title = `孕第${week.week}周`
    
    // 生成动态的总体总结
    let summary = `本周宝宝像一颗${week.baby_size}。`
    if (week.week === 1) summary = "孕期从末次月经的第一天开始计算。此时你的身体正在为可能到来的受精卵做准备。"
    else if (week.week === 4) summary = "这是一个神奇的时刻！受精卵成功着床，你真正意义上怀孕了！小生命开始扎根。"
    else if (week.week === 12) summary = "进入舒适的孕中期前夕，最重要的NT检查千万不要错过哦！"
    else if (week.week === 24) summary = "宝宝达到了存活临界点，令人期待的糖耐量测试也提上日程了。"
    else if (week.week === 37) summary = "足月啦！随时可能分娩，保持心态平和，随时准备迎接宝宝。"
    else if (week.week === 40) summary = "预产期到了！一切准备就绪，宝宝会在最好的时机与你相见。"

    // 格式化卡片所需的内容结构
    const contentObj = {
      baby: week.baby_development.join('\n'),
      mom: week.body.join('\n'),
      tips: [...week.nutrition, ...week.safety],
      todo: [
        ...week.checkup.map((c: string) => ({ type: 'checkup', title: '产检与注意事项', desc: c })),
        ...week.life_preparation.map((l: string) => ({ type: 'action', title: '生活准备', desc: l }))
      ]
    }
    
    // 匹配宝宝形状的 Emoji 供前端动效使用
    let emoji = '🌱'
    if (week.baby_size.includes('芝麻')) emoji = '🩸'
    else if (week.baby_size.includes('绿豆')) emoji = '🟢'
    else if (week.baby_size.includes('芸豆')) emoji = '🫘'
    else if (week.baby_size.includes('蓝莓')) emoji = '🫐'
    else if (week.baby_size.includes('草莓')) emoji = '🍓'
    else if (week.baby_size.includes('覆盆子')) emoji = '🍇'
    else if (week.baby_size.includes('葡萄')) emoji = '🍇'
    else if (week.baby_size.includes('金橘')) emoji = '🍊'
    else if (week.baby_size.includes('无花果')) emoji = '🌰'
    else if (week.baby_size.includes('李子')) emoji = '🍑'
    else if (week.baby_size.includes('豌豆')) emoji = '🫛'
    else if (week.baby_size.includes('柠檬')) emoji = '🍋'
    else if (week.baby_size.includes('苹果')) emoji = '🍎'
    else if (week.baby_size.includes('牛油果')) emoji = '🥑'
    else if (week.baby_size.includes('梨')) emoji = '🍐'
    else if (week.baby_size.includes('甜椒')) emoji = '🫑'
    else if (week.baby_size.includes('芒果')) emoji = '🥭'
    else if (week.baby_size.includes('香蕉')) emoji = '🍌'
    else if (week.baby_size.includes('胡萝卜')) emoji = '🥕'
    else if (week.baby_size.includes('玉米')) emoji = '🌽'
    else if (week.baby_size.includes('花椰菜')) emoji = '🥦'
    else if (week.baby_size.includes('生菜')) emoji = '🥬'
    else if (week.baby_size.includes('茄子')) emoji = '🍆'
    else if (week.baby_size.includes('南瓜')) emoji = '🎃'
    else if (week.baby_size.includes('大白菜')) emoji = '🥬'
    else if (week.baby_size.includes('椰子')) emoji = '🥥'
    else if (week.baby_size.includes('哈密瓜')) emoji = '🍈'
    else if (week.baby_size.includes('菠萝')) emoji = '🍍'
    else if (week.baby_size.includes('西瓜')) emoji = '🍉'
    else if (week.baby_size.includes('木瓜')) emoji = '🍈'

    // 将前端需要的结构写入 targetStage (作为 JSON 存储在 MySQL 中)
    const targetStage = { 
      stage: 'pregnancy', 
      week: week.week,
      babySizeEmoji: emoji,
      babySizeText: `约 ${week.baby_size_cm} cm`,
      babyWeight: week.baby_weight_g ? `约 ${week.baby_weight_g} g` : '尚未成型'
    }

    const existing = await prisma.article.findUnique({ where: { slug } })

    const data = {
      categoryId: category.id,
      title,
      summary,
      content: JSON.stringify(contentObj),
      difficulty: 'beginner',
      contentType: 'pregnancy_week',
      targetStage: targetStage satisfies Prisma.InputJsonObject,
      status: 1,
      isRecommended: 1
    }

    if (existing) {
      await prisma.article.update({ where: { id: existing.id }, data })
      console.log(`✅ 更新了第 ${week.week} 周数据`)
    } else {
      await prisma.article.create({ data })
      console.log(`➕ 创建了第 ${week.week} 周数据`)
    }
  }
  console.log('🎉 全部 40 周数据导入完成！')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
