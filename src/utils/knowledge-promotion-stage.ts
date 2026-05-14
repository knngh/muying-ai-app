export type KnowledgePromotionStage =
  | 'preparation'
  | 'first-trimester'
  | 'second-trimester'
  | 'third-trimester'
  | 'postpartum'
  | 'newborn'
  | '0-6-months'
  | '6-12-months'
  | '1-3-years'
  | '3-years-plus';

export interface KnowledgePromotionStageInput {
  category?: string;
  topic?: string;
  targetStage?: string[];
  target_stage?: string[];
}

export const KNOWLEDGE_PROMOTION_STAGE_VALUES: KnowledgePromotionStage[] = [
  'preparation',
  'first-trimester',
  'second-trimester',
  'third-trimester',
  'postpartum',
  'newborn',
  '0-6-months',
  '6-12-months',
  '1-3-years',
  '3-years-plus',
];

export function isKnowledgePromotionStage(value: string): value is KnowledgePromotionStage {
  return KNOWLEDGE_PROMOTION_STAGE_VALUES.includes(value as KnowledgePromotionStage);
}

export function normalizeKnowledgePromotionTargetStage(
  input: KnowledgePromotionStageInput,
  question: string,
): KnowledgePromotionStage[] {
  const text = `${question} ${input.category || ''} ${input.topic || ''}`;

  if (/备孕|孕前|preparation/iu.test(text)) {
    return ['preparation'];
  }
  if (/哺乳|母乳喂养|产后|postpartum|breastfeeding/iu.test(text)) {
    return ['postpartum'];
  }
  if (/孕早期|早孕|first-trimester/iu.test(text)) {
    return ['first-trimester'];
  }
  if (/孕吐|早孕反应|妊娠反应|孕期呕吐|nausea.+pregnancy|vomiting.+pregnancy/iu.test(text)) {
    return ['first-trimester'];
  }
  if (/孕中期|胎动|second-trimester/iu.test(text)) {
    return ['second-trimester'];
  }
  if (/孕晚期|入院|待产|宫缩|third-trimester/iu.test(text)) {
    return ['third-trimester'];
  }
  if (/孕期不适|孕期.{0,8}就医|孕产|怀孕|孕期|pregnancy/iu.test(text)) {
    return ['first-trimester', 'second-trimester', 'third-trimester'];
  }
  if (/宝宝|婴儿|儿童|孩子|皮疹|湿疹|发热|发烧|baby|child|children/iu.test(text)) {
    if (/发育里程碑|1-3|toddler|development/iu.test(text)) {
      return ['1-3-years'];
    }
    if (/新生儿|黄疸|脐带|newborn/iu.test(text)) {
      return ['newborn'];
    }
    if (/辅食|6\s*个月|6个月|6-12|feeding/iu.test(text)) {
      return ['6-12-months'];
    }
    return ['newborn', '0-6-months', '6-12-months', '1-3-years'];
  }
  if (/辅食|6\s*个月|6个月|6-12|feeding/iu.test(text)) {
    return ['6-12-months'];
  }
  if (/新生儿|黄疸|脐带|newborn/iu.test(text)) {
    return ['newborn'];
  }
  if (/发育里程碑|1-3|toddler|development/iu.test(text)) {
    return ['1-3-years'];
  }

  return [...(input.targetStage || []), ...(input.target_stage || [])]
    .filter((item): item is KnowledgePromotionStage =>
      typeof item === 'string' && isKnowledgePromotionStage(item));
}
