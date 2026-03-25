export interface Milestone {
  week: number
  emoji: string
  sizeLabel: string
  sizeCm: number | null
  weightG: number | null
  description: string
}

export const MILESTONES: Milestone[] = [
  {
    week: 1,
    emoji: '🌱',
    sizeLabel: '芝麻粒',
    sizeCm: 0.1,
    weightG: null,
    description: '受精卵完成着床，新生命的旅程开始了',
  },
  {
    week: 5,
    emoji: '💗',
    sizeLabel: '芸豆',
    sizeCm: 0.6,
    weightG: null,
    description: '心脏已分为左右两腔，开始跳动',
  },
  {
    week: 8,
    emoji: '🫐',
    sizeLabel: '覆盆子',
    sizeCm: 1.6,
    weightG: null,
    description: '所有主要器官已开始形成，首次B超',
  },
  {
    week: 12,
    emoji: '🍑',
    sizeLabel: '李子',
    sizeCm: 5.4,
    weightG: 14,
    description: '孕早期结束，NT筛查，进入快速生长期',
  },
  {
    week: 16,
    emoji: '🥑',
    sizeLabel: '牛油果',
    sizeCm: 11.6,
    weightG: 100,
    description: '可以通过超声分辨性别，开始有吸吮动作',
  },
  {
    week: 20,
    emoji: '🍌',
    sizeLabel: '香蕉',
    sizeCm: 16.4,
    weightG: 300,
    description: '孕期过半，大排畸超声，能听到外界声音',
  },
  {
    week: 24,
    emoji: '🌽',
    sizeLabel: '玉米棒',
    sizeCm: 30,
    weightG: 600,
    description: '存活里程碑！肺部开始产生表面活性物质',
  },
  {
    week: 28,
    emoji: '🍆',
    sizeLabel: '茄子',
    sizeCm: 37.6,
    weightG: 1005,
    description: '孕晚期开始，大脑快速发育，眼睛可以睁开',
  },
  {
    week: 32,
    emoji: '🍈',
    sizeLabel: '哈密瓜',
    sizeCm: 42.4,
    weightG: 1702,
    description: '胎位通常固定为头位，指甲长到指尖',
  },
  {
    week: 36,
    emoji: '🍈',
    sizeLabel: '木瓜',
    sizeCm: 47.4,
    weightG: 2622,
    description: '足月在即，每周产检，随时准备入院',
  },
  {
    week: 40,
    emoji: '🍉',
    sizeLabel: '南瓜',
    sizeCm: 51.2,
    weightG: 3462,
    description: '预产期到了！宝宝完全准备好了',
  },
]

export const BIRTH_MILESTONE = {
  emoji: '👶',
  title: '宝宝出生啦！',
  getBlessing: (gender?: string) => {
    if (gender === 'male') return '小王子驾到，愿他健康快乐地成长！'
    if (gender === 'female') return '小公主驾到，愿她健康快乐地成长！'
    return '欢迎来到这个世界，愿你健康快乐地成长！'
  },
}
