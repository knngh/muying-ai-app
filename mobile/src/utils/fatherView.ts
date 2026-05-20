import { resolveCaregiverRoleView } from './chatPrompts'

export function isFatherView(caregiverRole?: string | number | null) {
  return resolveCaregiverRoleView(caregiverRole) === 'father'
}

export function buildKnowledgeHeaderCopy(
  caregiverRole: string | number | null | undefined,
  stageLabel: string,
  isPreparationLifecycle: boolean,
) {
  if (isFatherView(caregiverRole)) {
    return {
      title: '按爸爸能执行的下一步看权威内容',
      subtitle: isPreparationLifecycle
        ? '备孕期先看检查、作息、营养和家庭分工，把能提前准备的事拆清楚。'
        : `默认优先展示贴近 ${stageLabel} 的内容，重点看检查清单、风险信号和本周能帮上的事。`,
      searchPlaceholder: isPreparationLifecycle
        ? '搜索备孕检查、分工、营养'
        : `搜索${stageLabel}检查、报告、分工`,
    }
  }

  return {
    title: '按阶段找到更贴近当前周期的权威内容',
    subtitle: isPreparationLifecycle
      ? '备孕期权威内容仍在持续补齐，当前默认先展示全站可用文章，并优先提供备孕相关检索建议。'
      : `默认优先展示更贴近 ${stageLabel} 的内容，可继续按分类、标签与来源收窄。`,
    searchPlaceholder: isPreparationLifecycle ? '搜索备孕、孕期相关内容' : `搜索${stageLabel}相关内容`,
  }
}

export function getKnowledgeShareActionLabel(caregiverRole?: string | number | null) {
  return isFatherView(caregiverRole) ? '发给我太太' : '发给我老公'
}

export function buildKnowledgeShareMessage(input: {
  caregiverRole?: string | number | null
  title: string
  summary?: string
  sourceUrl?: string
}) {
  const title = input.title.trim()
  const summary = input.summary?.trim()
  const sourceLine = input.sourceUrl ? `\n\n原文来源：${input.sourceUrl}` : ''
  const partnerLine = isFatherView(input.caregiverRole)
    ? '我先看了这篇，里面有几个点可以一起确认。'
    : '这篇可以发给家里一起看，方便分工时对齐重点。'

  return `${title}\n\n${summary || partnerLine}\n\n${partnerLine}${sourceLine}`
}
