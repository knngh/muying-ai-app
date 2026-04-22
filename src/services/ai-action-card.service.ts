import type { TrustedAIResult } from './trusted-ai.service';

export interface AIActionCard {
  id: string;
  type: 'calendar' | 'knowledge' | 'archive' | 'follow_up';
  label: string;
  title: string;
  description?: string;
  priority: 'primary' | 'secondary';
  payload?: {
    eventTitle?: string;
    eventDescription?: string;
    eventType?: 'checkup' | 'vaccine' | 'reminder' | 'exercise' | 'diet' | 'other';
    targetDate?: string;
    knowledgeKeyword?: string;
    sourceUrl?: string;
    prefillQuestion?: string;
    archiveFocus?: 'timeline' | 'report' | 'export';
  };
}

type ActionCardType = AIActionCard['type'];
type TriageCategory = TrustedAIResult['triageCategory'];

const ACTION_CARD_POLICY: Record<TriageCategory, ActionCardType[]> = {
  normal: ['calendar', 'knowledge', 'follow_up', 'archive'],
  caution: ['calendar', 'knowledge', 'follow_up', 'archive'],
  emergency: ['knowledge', 'archive'],
  out_of_scope: ['archive'],
};

function compactText(value: string | undefined, fallback: string): string {
  const normalized = (value || '').replace(/\s+/g, ' ').trim();
  return normalized || fallback;
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function buildKnowledgeKeyword(result: TrustedAIResult): string {
  const candidates = [
    result.sources[0]?.title,
    result.structuredAnswer.actions[0],
    result.structuredAnswer.conclusion,
  ];

  for (const candidate of candidates) {
    const normalized = compactText(candidate, '').split(/[，。；：:,.!?！？]/u)[0]?.trim();
    if (normalized) {
      return truncate(normalized, 24);
    }
  }

  return '母婴重点提醒';
}

function inferEventType(text: string): NonNullable<AIActionCard['payload']>['eventType'] {
  const compact = text.replace(/\s+/g, '');
  if (/疫苗|接种|补种/u.test(compact)) return 'vaccine';
  if (/产检|检查|复查|建档|nt\b|四维|糖耐|b超|超声|门诊/iu.test(compact)) return 'checkup';
  if (/运动|散步|瑜伽|锻炼/u.test(compact)) return 'exercise';
  if (/饮食|营养|补剂|叶酸|铁剂|钙剂|饮水/u.test(compact)) return 'diet';
  return 'reminder';
}

function buildTargetDate(result: TrustedAIResult): string {
  const text = [
    result.structuredAnswer.conclusion,
    ...result.structuredAnswer.actions,
    ...result.structuredAnswer.whenToSeekCare,
  ].join(' ');
  const compact = text.replace(/\s+/g, '');
  let offsetDays = 1;

  if (/今天|今日|今晚|现在|尽快|立即/u.test(compact)) {
    offsetDays = 0;
  } else if (/明天|次日/u.test(compact)) {
    offsetDays = 1;
  } else if (/后天/u.test(compact)) {
    offsetDays = 2;
  } else if (/本周|这周/u.test(compact)) {
    offsetDays = 2;
  } else if (/下周/u.test(compact)) {
    offsetDays = 7;
  }

  return new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function buildCalendarCard(result: TrustedAIResult): AIActionCard | null {
  const action = compactText(result.structuredAnswer.actions[0], '记录本轮建议并持续观察');
  const conclusion = compactText(result.structuredAnswer.conclusion, '把本轮建议保存为后续提醒。');
  const combined = [action, conclusion, ...result.structuredAnswer.whenToSeekCare].join(' ');

  return {
    id: 'calendar-primary',
    type: 'calendar',
    label: result.triageCategory === 'caution' ? '记录观察' : '加入日历',
    title: result.triageCategory === 'caution' ? '把观察重点放进日历' : '保存为下一步安排',
    description: truncate(conclusion, 60),
    priority: 'primary',
    payload: {
      eventTitle: truncate(action, 24),
      eventDescription: truncate(conclusion, 120),
      eventType: inferEventType(combined),
      targetDate: buildTargetDate(result),
    },
  };
}

function buildKnowledgeCard(result: TrustedAIResult): AIActionCard | null {
  if (result.sources.length === 0) {
    return null;
  }

  const keyword = buildKnowledgeKeyword(result);
  return {
    id: 'knowledge-secondary',
    type: 'knowledge',
    label: '相关知识',
    title: '查看本轮关联来源',
    description: truncate(result.sources[0]?.title || keyword, 60),
    priority: 'secondary',
    payload: {
      knowledgeKeyword: keyword,
      sourceUrl: result.sources[0]?.url,
    },
  };
}

function buildArchiveCard(result: TrustedAIResult): AIActionCard {
  return {
    id: 'archive-secondary',
    type: 'archive',
    label: '沉淀档案',
    title: '把这次问题留到阶段记录',
    description: result.triageCategory === 'emergency'
      ? '紧急处理后，可再回到档案补充这次经历。'
      : '后续周报和成长档案会更完整。',
    priority: 'secondary',
    payload: {
      archiveFocus: 'timeline',
    },
  };
}

function buildFollowUpCard(result: TrustedAIResult): AIActionCard | null {
  const question = result.followUpQuestions[0];
  if (!question || result.triageCategory === 'emergency' || result.triageCategory === 'out_of_scope') {
    return null;
  }

  return {
    id: 'follow-up-secondary',
    type: 'follow_up',
    label: '继续追问',
    title: '继续把问题问具体',
    description: truncate(question, 60),
    priority: 'secondary',
    payload: {
      prefillQuestion: question,
    },
  };
}

export function buildAIActionCards(result: TrustedAIResult): AIActionCard[] {
  const builders: Record<ActionCardType, () => AIActionCard | null> = {
    calendar: () => buildCalendarCard(result),
    knowledge: () => buildKnowledgeCard(result),
    follow_up: () => buildFollowUpCard(result),
    archive: () => buildArchiveCard(result),
  };
  const cards = ACTION_CARD_POLICY[result.triageCategory]
    .map((type) => builders[type]())
    .filter((card): card is AIActionCard => Boolean(card));

  return cards.slice(0, 4);
}
