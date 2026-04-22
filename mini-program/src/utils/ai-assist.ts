import type { Article } from '@/api/modules'

export interface KnowledgeAiTerm {
  term: string
  explanation: string
}

export interface KnowledgeAiAssist {
  audienceLabel: string
  focusLabel: string
  points: string[]
  terms: KnowledgeAiTerm[]
  safetyNote: string
}

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

export interface DiaryAiAnalysis {
  tags: string[]
  summary: string
  highlights: string[]
  prompt: string
}

type ChatContextRecord = Record<string, string | number | boolean | null>

const topicLabelMap: Record<string, string> = {
  pregnancy: '孕期与产检',
  postpartum: '产后恢复',
  newborn: '新生儿护理',
  feeding: '喂养与辅食',
  vaccination: '疫苗与预防',
  'common-symptoms': '常见症状',
  development: '发育照护',
  policy: '政策信息',
  general: '通用知识',
}

const stageLabelMap: Record<string, string> = {
  preparation: '备孕期',
  'first-trimester': '孕早期',
  'second-trimester': '孕中期',
  'third-trimester': '孕晚期',
  '0-6-months': '0-6 月',
  '6-12-months': '6-12 月',
  '1-3-years': '1-3 岁',
}

const termDictionary: Array<{ pattern: RegExp; term: string; explanation: string }> = [
  { pattern: /叶酸/u, term: '叶酸', explanation: '常用于孕前和孕早期营养补充，重点是按医生或指南建议稳定补充。' },
  { pattern: /HCG|绒毛膜促性腺激素/iu, term: 'HCG', explanation: '早孕期常见检查指标，变化趋势通常比单次数值更有参考意义。' },
  { pattern: /孕酮|黄体酮/u, term: '孕酮', explanation: '与早孕支持相关，是否需要处理应结合症状、孕周和医生判断。' },
  { pattern: /胎动/u, term: '胎动', explanation: '孕中晚期重要观察点，明显减少、异常频繁或和平时差异大时应及时咨询医生。' },
  { pattern: /宫缩/u, term: '宫缩', explanation: '需要结合频率、疼痛、出血和孕周判断，规律增强或伴随异常时不建议自行处理。' },
  { pattern: /黄疸/u, term: '黄疸', explanation: '新生儿常见观察项，需关注出现时间、持续时间、精神和吃奶情况。' },
  { pattern: /母乳|哺乳|喂养/u, term: '喂养', explanation: '重点观察吃奶频率、尿便、体重增长和妈妈乳房状态。' },
  { pattern: /疫苗|接种/u, term: '疫苗接种', explanation: '按当地免疫规划和接种门诊安排执行，延迟或特殊情况要单独确认。' },
  { pattern: /发热|体温|高热/u, term: '发热', explanation: '婴幼儿或孕期发热都不建议只靠经验判断，需结合体温、精神状态和伴随症状。' },
  { pattern: /产检|建档|B超|超声/u, term: '产检节点', explanation: '产检更适合提前预约并记录结果，异常指标要带着原始报告咨询医生。' },
]

const diaryTagRules: Array<{ tag: string; pattern: RegExp }> = [
  { tag: '产检', pattern: /产检|B超|超声|唐筛|NT|糖耐|血压|尿检|报告|医生/u },
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

function normalizeStage(article: Article | null | undefined): string {
  const rawStage = article?.stage
  if (!rawStage) return ''

  if (typeof rawStage === 'string') {
    const direct = rawStage.trim()
    if (direct in stageLabelMap) return direct

    try {
      const parsed = JSON.parse(direct)
      if (Array.isArray(parsed)) {
        return parsed.find(item => typeof item === 'string' && item in stageLabelMap) || ''
      }
    } catch {
      return ''
    }
  }

  return ''
}

function quoteSnippet(value: string, maxLength: number): string {
  const normalized = cleanText(value)
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized
}

export function buildKnowledgeDetailQuestion(input: {
  title: string
  summary?: string | null
  sourceOrg?: string | null
  topic?: string | null
}): string {
  const title = quoteSnippet(input.title, 60) || '这篇权威内容'
  const summary = quoteSnippet(input.summary || '', 140)
  const sourceText = cleanText(input.sourceOrg) ? `来源机构是${cleanText(input.sourceOrg)}。` : ''
  const topicText = cleanText(input.topic) ? `主题是${cleanText(input.topic)}。` : ''

  if (summary) {
    return [
      `我正在看一篇关于“${title}”的权威内容。`,
      sourceText,
      topicText,
      `摘要里提到：“${summary}”。`,
      '请结合当前阶段帮我解释这篇内容最值得关注的点，以及我接下来该怎么理解和安排？',
    ].filter(Boolean).join('')
  }

  return [
    `我正在看一篇关于“${title}”的权威内容。`,
    sourceText,
    topicText,
    '请结合当前阶段帮我提炼这篇文章最值得关注的点，以及我接下来该怎么理解和安排？',
  ].filter(Boolean).join('')
}

export function buildRecentAiTopicQuestion(topic: string, stageLabel: string): string {
  const topicText = cleanText(topic) || '最近命中的主题'
  const stageText = cleanText(stageLabel) || '当前阶段'
  return `最近浏览里多次命中“${topicText}”这个主题。请结合我当前的${stageText}阶段，帮我梳理这个主题最值得关注的点，以及接下来可以怎么安排？`
}

export function buildRecentAiSourceQuestion(source: string, stageLabel: string): string {
  const sourceText = cleanText(source) || '这个权威来源'
  const stageText = cleanText(stageLabel) || '当前阶段'
  return `最近浏览里多次出现${sourceText}相关的权威内容。请结合我当前的${stageText}阶段，帮我总结这个来源下最值得优先看的主题，以及我接下来该关注什么？`
}

export function buildKnowledgeDetailChatContext(input: {
  slug: string
  title: string
  sourceOrg?: string | null
  topic?: string | null
  summary?: string | null
  stageKey?: string | null
}): ChatContextRecord {
  return {
    entrySource: 'knowledge_detail',
    stage: input.stageKey?.trim() || null,
    articleSlug: input.slug,
    articleTitle: input.title.replace(/\s+/g, ' ').trim().slice(0, 120),
    articleSourceOrg: input.sourceOrg?.replace(/\s+/g, ' ').trim().slice(0, 80) || null,
    articleTopic: input.topic?.replace(/\s+/g, ' ').trim().slice(0, 60) || null,
    articleSummary: input.summary?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180) || null,
  }
}

export function buildKnowledgeAiAssist(article: Article | null | undefined): KnowledgeAiAssist {
  const stage = normalizeStage(article)
  const topic = article?.topic || ''
  const focusLabel = topicLabelMap[topic] || topic || '当前主题'
  const audienceLabel = article?.audience || stageLabelMap[stage] || '母婴家庭通用参考'
  const summarySentences = splitReadableSentences(article?.summary || article?.content || '')
  const contentSample = cleanText(`${article?.title || ''} ${article?.summary || ''} ${article?.content || ''}`)
  const terms = termDictionary
    .filter(item => item.pattern.test(contentSample))
    .slice(0, 3)
    .map(({ term, explanation }) => ({ term, explanation }))

  const points = [
    summarySentences[0] ? truncateText(summarySentences[0], 62) : `先确认这篇内容是否适合${audienceLabel}。`,
    stageLabelMap[stage] ? `适用阶段偏向${stageLabelMap[stage]}，阅读时优先看和当前阶段匹配的部分。` : `主题集中在${focusLabel}，适合和同主题资料一起看。`,
    article?.sourceOrg || article?.source ? `来源来自${article.sourceOrg || article.source}，建议结合原文更新时间核对。` : '建议结合原始来源、摘要和同步时间一起判断。',
  ]

  return {
    audienceLabel,
    focusLabel,
    points,
    terms,
    safetyNote: '阅读整理只做参考，不替代医生判断；涉及症状加重、用药或治疗方案时请线下确认。',
  }
}

function getTodoPriorityScore(todo: WeekTodoCandidate): number {
  const text = `${todo.title} ${todo.desc}`
  let score = todo.completed ? -40 : 0

  if (/出血|腹痛|胎动|宫缩|发热|高热|黄疸|异常|立即|及时就医|复查/u.test(text)) score += 90
  if (/产检|检查|B超|超声|建档|唐筛|NT|糖耐|疫苗|接种/u.test(text)) score += 70
  if (/预约|准备|记录|补充|叶酸|营养|睡眠|运动/u.test(text)) score += 45
  if (todo.type === 'checkup') score += 25
  if (todo.type === 'custom') score += 20

  return score
}

function buildTodoReason(todo: WeekTodoCandidate): string {
  const text = `${todo.title} ${todo.desc}`
  if (/出血|腹痛|胎动|宫缩|发热|高热|黄疸|异常|立即|及时就医/u.test(text)) {
    return '涉及需要优先观察或及时处理的信号，建议排在前面。'
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
    desc: params.summary || '当前周内容较少时，可以先记录身体变化、医生提醒或下一步待办。',
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

export function analyzeDiaryEntry(content?: string | null): DiaryAiAnalysis {
  const text = cleanText(content)
  if (!text) {
    return {
      tags: [],
      summary: '还没有可整理的记录。',
      highlights: [],
      prompt: '建议记录：身体变化、产检结果、医生提醒和下一步待办。',
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
    prompt: '下次补充时可以写清楚时间、持续多久、是否已咨询医生。',
  }
}
