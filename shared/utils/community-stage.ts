import dayjs from 'dayjs'
import type { CommunityPost, User } from '../types'

export type CommunityStageOnly =
  | 'preparing'
  | 'pregnant_early'
  | 'pregnant_mid'
  | 'pregnant_late'
  | 'postpartum_recovery'
  | 'parenting'

export type CommunityStageKey = 'all' | CommunityStageOnly

export interface CommunityStageOption {
  key: CommunityStageKey
  label: string
  shortLabel: string
}

export const COMMUNITY_STAGE_OPTIONS: CommunityStageOption[] = [
  { key: 'all', label: '全部', shortLabel: '全部' },
  { key: 'preparing', label: '备孕圈', shortLabel: '备孕' },
  { key: 'pregnant_early', label: '孕早期圈', shortLabel: '孕早' },
  { key: 'pregnant_mid', label: '孕中期圈', shortLabel: '孕中' },
  { key: 'pregnant_late', label: '孕晚期圈', shortLabel: '孕晚' },
  { key: 'postpartum_recovery', label: '产后恢复圈', shortLabel: '产后' },
  { key: 'parenting', label: '育儿圈', shortLabel: '育儿' },
]

export const COMMUNITY_STAGE_LABELS = COMMUNITY_STAGE_OPTIONS.reduce<Record<CommunityStageKey, string>>((acc, item) => {
  acc[item.key] = item.label
  return acc
}, {} as Record<CommunityStageKey, string>)

function normalizePregnancyStatus(value?: string | number | null): 'preparing' | 'pregnant' | 'postpartum' {
  if (value === 2 || value === '2' || value === 'pregnant') return 'pregnant'
  if (value === 3 || value === '3' || value === 'postpartum') return 'postpartum'
  return 'preparing'
}

export function getCommunityStageLabel(stage: CommunityStageKey): string {
  return COMMUNITY_STAGE_LABELS[stage]
}

export function getUserCommunityStage(user?: Pick<User, 'pregnancyStatus' | 'dueDate' | 'babyBirthday'> | null): CommunityStageOnly {
  const status = normalizePregnancyStatus(user?.pregnancyStatus)

  if (status === 'pregnant') {
    if (!user?.dueDate) return 'pregnant_mid'

    const dueDate = dayjs(user.dueDate)
    const elapsedDays = Math.max(0, 280 - dueDate.diff(dayjs(), 'day'))
    const week = Math.max(1, Math.floor(elapsedDays / 7) + 1)

    if (week <= 13) return 'pregnant_early'
    if (week <= 27) return 'pregnant_mid'
    return 'pregnant_late'
  }

  if (status === 'postpartum') {
    if (!user?.babyBirthday) return 'postpartum_recovery'

    const ageDays = Math.max(0, dayjs().diff(dayjs(user.babyBirthday), 'day'))
    return ageDays <= 42 ? 'postpartum_recovery' : 'parenting'
  }

  return 'preparing'
}

const STAGE_KEYWORDS: Record<CommunityStageOnly, RegExp[]> = {
  preparing: [
    /备孕/u,
    /排卵/u,
    /叶酸/u,
    /基础体温/u,
    /卵泡/u,
    /精子/u,
    /月经/u,
    /姨妈/u,
    /同房/u,
    /备孕检查/u,
  ],
  pregnant_early: [
    /孕早/u,
    /早孕/u,
    /孕反/u,
    /hcg/i,
    /孕酮/u,
    /nt/i,
    /建档/u,
    /见胎心/u,
    /先兆流产/u,
    /前三个月/u,
  ],
  pregnant_mid: [
    /孕中/u,
    /孕中期/u,
    /四维/u,
    /糖耐/u,
    /大排畸/u,
    /胎动/u,
    /控糖/u,
    /补铁/u,
    /补钙/u,
    /宫高/u,
  ],
  pregnant_late: [
    /孕晚/u,
    /孕晚期/u,
    /足月/u,
    /宫缩/u,
    /见红/u,
    /破水/u,
    /入盆/u,
    /待产/u,
    /顺产/u,
    /剖宫产/u,
  ],
  postpartum_recovery: [
    /产后/u,
    /月子/u,
    /恶露/u,
    /侧切/u,
    /剖腹产/u,
    /剖宫产伤口/u,
    /开奶/u,
    /涨奶/u,
    /堵奶/u,
    /盆底/u,
  ],
  parenting: [
    /宝宝/u,
    /新生儿/u,
    /喂养/u,
    /夜醒/u,
    /奶量/u,
    /母乳/u,
    /奶粉/u,
    /辅食/u,
    /湿疹/u,
    /疫苗/u,
  ],
}

const STAGE_PRIORITY: CommunityStageOnly[] = [
  'postpartum_recovery',
  'parenting',
  'pregnant_late',
  'pregnant_mid',
  'pregnant_early',
  'preparing',
]

function getKeywordScore(haystack: string, patterns: RegExp[]): number {
  return patterns.reduce((score, pattern) => (pattern.test(haystack) ? score + 1 : score), 0)
}

export function resolveCommunityStageFromText(text: string): CommunityStageOnly {
  const haystack = text.trim()
  if (!haystack) return 'preparing'

  const ranked = STAGE_PRIORITY.map((stage, index) => ({
    stage,
    score: getKeywordScore(haystack, STAGE_KEYWORDS[stage]),
    index,
  })).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.index - b.index
  })

  if (ranked[0]?.score > 0) {
    return ranked[0].stage
  }

  if (/产后|月子|恶露|开奶|涨奶|堵奶|伤口/u.test(haystack)) {
    return 'postpartum_recovery'
  }

  if (/宝宝|新生儿|喂养|夜醒|辅食|奶量|疫苗/u.test(haystack)) {
    return 'parenting'
  }

  if (/宫缩|见红|破水|待产|足月|入盆/u.test(haystack)) {
    return 'pregnant_late'
  }

  if (/四维|糖耐|大排畸|胎动|补铁|补钙/u.test(haystack)) {
    return 'pregnant_mid'
  }

  if (/孕|产检|预产期|nt|hcg|孕酮|建档/u.test(haystack)) {
    return 'pregnant_early'
  }

  return 'preparing'
}

export function resolveCommunityStageFromPost(post: Pick<CommunityPost, 'categoryName' | 'category' | 'title' | 'content'>): CommunityStageOnly {
  const haystack = [post.categoryName, post.category, post.title, post.content].filter(Boolean).join(' ')
  return resolveCommunityStageFromText(haystack)
}
