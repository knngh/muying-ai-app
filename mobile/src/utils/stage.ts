import dayjs from 'dayjs'
import type { User } from '../api/modules'
import {
  getCommunityStageLabel,
  getUserCommunityStage,
  type CommunityStageOnly,
} from '../../../shared/utils/community-stage'

export {
  COMMUNITY_STAGE_LABELS,
  COMMUNITY_STAGE_OPTIONS,
  getCommunityStageLabel,
  getUserCommunityStage,
  resolveCommunityStageFromPost,
  type CommunityStageKey,
  type CommunityStageOnly,
} from '../../../shared/utils/community-stage'

export type StageKind = 'preparing' | 'pregnant' | 'postpartum'

export interface StageSummary {
  kind: StageKind
  communityStage: CommunityStageOnly
  communityStageLabel: string
  title: string
  subtitle: string
  focusTitle: string
  reminder: string
  readingTopic: string
  aiTipPreview: string
  aiTipFull: string
}

function normalizePregnancyStatus(value?: string | number | null): StageKind {
  if (value === 2 || value === '2' || value === 'pregnant') return 'pregnant'
  if (value === 3 || value === '3' || value === 'postpartum') return 'postpartum'
  return 'preparing'
}

export function getStageSummary(user?: User | null): StageSummary {
  const now = dayjs()
  const kind = normalizePregnancyStatus(user?.pregnancyStatus)
  const communityStage = getUserCommunityStage(user)

  if (kind === 'pregnant' && user?.dueDate) {
    const dueDate = dayjs(user.dueDate)
    const elapsedDays = Math.max(0, 280 - dueDate.diff(now, 'day'))
    const week = Math.max(1, Math.floor(elapsedDays / 7) + 1)
    const day = (elapsedDays % 7) + 1

    return {
      kind,
      communityStage,
      communityStageLabel: getCommunityStageLabel(communityStage),
      title: `孕 ${week} 周 ${day} 天`,
      subtitle: '宝宝和你的身体都在快速变化，今天更适合低刺激、稳节奏的安排。',
      focusTitle: '本周关注',
      reminder: '补充优质蛋白和水分，晚上尽量在固定时间休息。',
      readingTopic: '本周必读：孕期营养与常见不适缓解',
      aiTipPreview: '今天适合围绕饮食、产检和睡眠做 1 次重点咨询。',
      aiTipFull: '今天适合围绕饮食、产检和睡眠做 1 次重点咨询，优先确认本周产检准备、叶酸/铁剂补充和晚间水肿管理。',
    }
  }

  if (kind === 'pregnant') {
    return {
      kind,
      communityStage,
      communityStageLabel: getCommunityStageLabel(communityStage),
      title: '孕期阶段',
      subtitle: '先把产检、营养和休息节奏稳住，再逐步补齐本周重点。',
      focusTitle: '本周关注',
      reminder: '记录最近一次产检和身体不适，方便持续追踪变化。',
      readingTopic: '本周必读：孕期检查与常见不适管理',
      aiTipPreview: '可以先让问题助手帮你梳理本周最该关注的 3 件事。',
      aiTipFull: '可以先让问题助手帮你梳理本周最该关注的 3 件事，优先覆盖产检准备、饮食补充和休息节律。',
    }
  }

  if (kind === 'postpartum' && user?.babyBirthday) {
    const babyBirthday = dayjs(user.babyBirthday)
    const ageDays = Math.max(0, now.diff(babyBirthday, 'day'))
    const month = Math.floor(ageDays / 30)
    const day = ageDays % 30

    return {
      kind,
      communityStage,
      communityStageLabel: getCommunityStageLabel(communityStage),
      title: `宝宝 ${month} 月 ${day} 天`,
      subtitle: '作息和喂养节奏比完美计划更重要，今天先稳住一件关键小事。',
      focusTitle: '今日重点',
      reminder: '观察吃奶、睡眠和精神状态，有异常先记录再处理。',
      readingTopic: '本周必读：喂养节奏与常见护理问题',
      aiTipPreview: '可以把今天最困扰的一件育儿问题交给问题助手拆解。',
      aiTipFull: '可以把今天最困扰的一件育儿问题交给问题助手拆解，例如喂养间隔、夜醒原因判断或皮肤护理优先级。',
    }
  }

  if (kind === 'postpartum') {
    return {
      kind,
      communityStage,
      communityStageLabel: getCommunityStageLabel(communityStage),
      title: '产后阶段',
      subtitle: '先关注身体恢复、喂养节奏和睡眠压力，不用一次解决所有问题。',
      focusTitle: '今日重点',
      reminder: '优先记录睡眠、喂养和身体恢复情况，异常时更容易判断。',
      readingTopic: '本周必读：产后恢复与新生儿照护重点',
      aiTipPreview: '把今天最卡的一件事交给问题助手拆成更容易执行的小步骤。',
      aiTipFull: '把今天最卡的一件事交给问题助手拆成更容易执行的小步骤，例如伤口恢复、开奶调整或夜醒排查。',
    }
  }

  return {
    kind: 'preparing',
    communityStage,
    communityStageLabel: getCommunityStageLabel(communityStage),
    title: '备孕阶段',
    subtitle: '先把节律、营养和基础检查打稳，后续体验会轻松很多。',
    focusTitle: '本周建议',
    reminder: '保持规律作息，补充叶酸并安排基础检查。',
    readingTopic: '本周必读：备孕检查与营养准备',
    aiTipPreview: '先让问题助手帮你列一个 7 天备孕准备清单。',
    aiTipFull: '先让问题助手帮你列一个 7 天备孕准备清单，重点覆盖叶酸、体检、作息和饮食调整。',
  }
}
