export interface WeekTodoCandidate {
  type?: string
  title: string
  desc: string
  completed?: boolean
}

export interface WeekPriorityItem {
  title: string
  desc: string
  reason: string
  label: string
  completed: boolean
}

export interface WeekPriorityPlan {
  title: string
  subtitle: string
  items: WeekPriorityItem[]
  reminder: string
}

export interface DiaryRecordAnalysis {
  tags: string[]
  summary: string
  highlights: string[]
  prompt: string
}

const diaryTagRules: Array<{ tag: string; pattern: RegExp }> = [
  { tag: '产检', pattern: /产检|B超|超声|唐筛|NT|糖耐|血压|尿检|报告|复诊/u },
  { tag: '胎动', pattern: /胎动|动得|动了|踢|宫缩/u },
  { tag: '不适症状', pattern: /腹痛|出血|疼|痛|头晕|恶心|呕吐|水肿|腰酸|发热|发烧|咳嗽/u },
  { tag: '情绪', pattern: /焦虑|担心|害怕|开心|难过|烦|压力|心情|情绪/u },
  { tag: '睡眠', pattern: /睡|失眠|夜醒|困|疲惫|乏力/u },
  { tag: '饮食营养', pattern: /吃|胃口|食欲|叶酸|补铁|钙|DHA|营养|体重/u },
  { tag: '待办提醒', pattern: /预约|准备|买|办理|建档|复查|提醒|待办/u },
  { tag: '喂养', pattern: /母乳|奶粉|吃奶|喂奶|吐奶|辅食/u },
]

function cleanText(value?: string | null): string {
  return (value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitReadableSentences(value: string): string[] {
  return cleanText(value)
    .split(/[。！？!?；;\n]/u)
    .map(item => item.trim())
    .filter(item => item.length >= 8)
}

function truncateText(value: string, maxLength: number): string {
  const text = cleanText(value)
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1)}…`
}

function getTodoPriorityScore(todo: WeekTodoCandidate): number {
  const text = `${todo.title} ${todo.desc}`
  let score = todo.completed ? -40 : 0

  if (/出血|腹痛|胎动|宫缩|发热|高热|黄疸|异常|线下|复查/u.test(text)) score += 90
  if (/产检|检查|B超|超声|建档|唐筛|NT|糖耐|疫苗|接种/u.test(text)) score += 70
  if (/预约|准备|记录|补充|叶酸|营养|睡眠|运动/u.test(text)) score += 45
  if (todo.type === 'checkup') score += 25
  if (todo.type === 'custom') score += 20

  return score
}

function buildTodoReason(todo: WeekTodoCandidate): string {
  const text = `${todo.title} ${todo.desc}`
  if (/出血|腹痛|胎动|宫缩|发热|高热|黄疸|异常|线下/u.test(text)) {
    return '涉及需要优先记录和线下确认的信号，建议排在前面。'
  }
  if (/产检|检查|B超|超声|建档|唐筛|NT|糖耐|疫苗|接种/u.test(text)) {
    return '属于有时间窗口的检查或接种事项，适合提前安排。'
  }
  if (/记录|日记|胎动/u.test(text)) {
    return '记录类事项会影响后续复盘和周报质量，越早补越完整。'
  }
  return '这是本周可执行的基础动作，完成后能减少后续遗漏。'
}

export function buildWeekPriorityPlan(params: {
  week: number
  summary?: string
  tips?: string[]
  todos: WeekTodoCandidate[]
  completedCount: number
  hasDiary: boolean
}): WeekPriorityPlan {
  const rankedTodos = [...params.todos]
    .sort((left, right) => getTodoPriorityScore(right) - getTodoPriorityScore(left))
    .slice(0, 3)

  const fallbackTips = (params.tips || []).slice(0, 3).map((tip, index) => ({
    title: index === 0 ? '先看本周建议' : '补一个小动作',
    desc: tip,
    completed: false,
  }))

  const rawItemsSource = rankedTodos.length ? rankedTodos : fallbackTips
  const itemsSource = rawItemsSource.length ? rawItemsSource : [{
    title: '先补一条本周记录',
    desc: params.summary || '当前周内容较少时，可以先记录身体变化、线下提醒或下一步待办。',
    completed: false,
  }]
  const items = itemsSource.map((todo, index) => ({
    title: todo.title,
    desc: todo.desc,
    reason: buildTodoReason(todo),
    label: todo.completed ? '已完成' : index === 0 ? '优先' : index === 1 ? '本周' : '可补',
    completed: Boolean(todo.completed),
  }))

  return {
    title: `第 ${params.week} 周阅读重点`,
    subtitle: params.summary ? truncateText(params.summary, 54) : '先处理最影响本周节奏的事项。',
    items,
    reminder: params.hasDiary
      ? `已写本周记录，建议继续补齐待办进度：${params.completedCount}/${params.todos.length || 0}。`
      : '完成重点待办后，建议补一条本周记录，方便后面回看变化。',
  }
}

export function analyzeDiaryEntry(content?: string | null): DiaryRecordAnalysis {
  const text = cleanText(content)
  if (!text) {
    return {
      tags: [],
      summary: '还没有可整理的记录。',
      highlights: [],
      prompt: '建议记录：身体变化、产检结果、线下提醒和下一步待办。',
    }
  }

  const tags = diaryTagRules
    .filter(rule => rule.pattern.test(text))
    .map(rule => rule.tag)
    .slice(0, 4)
  const normalizedTags = tags.length ? tags : ['本周记录']
  const sentences = splitReadableSentences(text)
  const highlights = (sentences.length ? sentences : [text])
    .slice(0, 2)
    .map(item => truncateText(item, 56))

  return {
    tags: normalizedTags,
    summary: `${normalizedTags.join('、')}是这条记录里的主要信息，适合后续复盘时优先回看。`,
    highlights,
    prompt: '下次补充时可以写清楚时间、持续多久、是否已线下确认。',
  }
}
