/**
 * AI 上下文工具模块 — 统一 pattern 定义、上下文处理和领域决策
 *
 * 此前 normalizeContext / shouldUseProfileHints / buildAnswerPolicy /
 * resolveDomainDecision 等函数分别在 ai.controller、trusted-ai.service、
 * websocket.service 三处独立维护，存在 pattern 不一致的风险。
 * 现统一收敛到此文件，三处改为引用。
 */

import {
  classifyMaternalChildQuestion,
  hasExcludedDomainSignal,
  hasHealthOrCareSignal,
  hasMaternalChildSignal,
  type AIDomainDecision,
} from './ai-domain.service';
import { buildUserProfileContext } from './ai-user-context.service';
import { buildKnowledgePackWithRewrite } from './knowledge.service';

// ============================================================
// Pattern 定义（唯一来源）
// ============================================================

export const EXPLICIT_STAGE_PATTERNS: ReadonlyArray<RegExp> = [
  /孕早期|怀孕早期|怀孕初期|刚怀孕/u,
  /孕中期|怀孕中期/u,
  /孕晚期|怀孕晚期|怀孕后期/u,
  /备孕/u,
  /产后|月子/u,
  /新生儿/u,
  /\d{1,2}\s*周/u,
  /怀孕\d{1,2}\s*个?月/u,
  /\d{1,2}\s*个?月龄/u,
  /\d{1,2}\s*个?月宝宝/u,
];

/** 完整版（22 个症状词），统一所有调用方 */
export const CHILDCARE_SCENE_PATTERNS: ReadonlyArray<RegExp> = [
  /(宝宝|婴儿|新生儿|幼儿|孩子|儿童).{0,8}(发烧|发热|咳嗽|腹泻|拉肚子|便秘|吐奶|湿疹|黄疸|皮疹|疫苗|奶量|喂奶|吃奶|夜醒|夜里总醒|夜间醒|睡觉|睡眠|哄睡|哭闹|闹觉|安抚|便便|辅食|厌奶|发育|体重|身高)/u,
  /(发烧|发热|咳嗽|腹泻|拉肚子|便秘|吐奶|湿疹|黄疸|皮疹|疫苗|奶量|喂奶|吃奶|夜醒|夜里总醒|夜间醒|睡觉|睡眠|哄睡|哭闹|闹觉|安抚|便便|辅食|厌奶|发育|体重|身高).{0,8}(宝宝|婴儿|新生儿|幼儿|孩子|儿童)/u,
  /宝宝月龄|婴儿护理|儿童护理|儿科|宝宝作息|宝宝睡眠/u,
  /\d{1,2}\s*个?月(宝宝|婴儿|孩子|儿童)/u,
];

// ============================================================
// 基础工具函数
// ============================================================

export function hasExplicitStageSignal(text?: string): boolean {
  return !!text && EXPLICIT_STAGE_PATTERNS.some((p) => p.test(text));
}

export function hasChildcareSceneSignal(text?: string): boolean {
  return !!text && CHILDCARE_SCENE_PATTERNS.some((p) => p.test(text));
}

const CONTEXT_LABEL_MAP: Record<string, string> = {
  stage: '当前阶段',
  weeks: '孕周',
  week: '孕周',
  babyAge: '宝宝年龄',
  ageMonths: '宝宝月龄',
  symptoms: '补充症状',
  notes: '补充说明',
};

/**
 * 将用户提供的 context 格式化为带中文标签的展示文本。
 * 用于拼入 system prompt。
 */
export function normalizeContext(context: unknown): string | undefined {
  if (!context) return undefined;

  if (typeof context === 'string') {
    const trimmed = context.trim();
    return trimmed || undefined;
  }

  if (typeof context !== 'object' || Array.isArray(context)) return undefined;

  const lines = Object.entries(context as Record<string, unknown>)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .slice(0, 8)
    .map(([key, value]) => `- ${CONTEXT_LABEL_MAP[key] || key}：${String(value)}`);

  return lines.length > 0 ? `用户补充背景：\n${lines.join('\n')}` : undefined;
}

/**
 * 提取 context 中的原始信号文本（不带标签，用于 pattern 匹配）。
 */
export function getContextSignalText(context: unknown): string | undefined {
  if (!context) return undefined;

  if (typeof context === 'string') {
    const trimmed = context.trim();
    return trimmed || undefined;
  }

  if (typeof context !== 'object' || Array.isArray(context)) return undefined;

  const parts = Object.entries(context as Record<string, unknown>)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .slice(0, 8)
    .map(([key, value]) => `${key} ${String(value).trim()}`)
    .filter(Boolean);

  return parts.length > 0 ? parts.join('\n') : undefined;
}

const STRUCTURED_CONTEXT_KEYS = ['stage', 'weeks', 'week', 'babyAge', 'ageMonths'];

/**
 * 判断 context 是否包含显式阶段结构化字段。
 * 支持 string（退化为 stageSignal 检测）和 object 两种输入。
 */
export function hasExplicitStructuredContext(context: unknown): boolean {
  if (!context) return false;

  // string 输入时退化为阶段信号检测（controller 原有逻辑）
  if (typeof context === 'string') return hasExplicitStageSignal(context);

  if (typeof context !== 'object' || Array.isArray(context)) return false;

  const record = context as Record<string, unknown>;
  return STRUCTURED_CONTEXT_KEYS.some((key) => {
    const value = record[key];
    return value !== undefined && value !== null && value !== '';
  });
}

export function shouldUseProfileHints(question: string, userContext: unknown): boolean {
  const contextSignals = getContextSignalText(userContext);
  return (
    !hasExplicitStageSignal(question) &&
    !hasExplicitStructuredContext(userContext) &&
    !hasChildcareSceneSignal(question) &&
    !hasChildcareSceneSignal(contextSignals)
  );
}

export function buildMergedContext(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join('\n\n');
}

/**
 * 构建回答策略提示词。
 * 合并 trusted-ai 的增强规则（模型记忆优先级）与 controller 的详细提示。
 */
export function buildAnswerPolicy(question: string, userContext: unknown): string {
  const explicitStage =
    hasExplicitStageSignal(question) || hasExplicitStructuredContext(userContext);
  const childcareScene =
    hasChildcareSceneSignal(question) ||
    hasChildcareSceneSignal(getContextSignalText(userContext));

  const lines = [
    '回答策略：',
    '- 以用户当前问题和本轮补充信息为优先。',
    '- 用户历史档案仅作辅助参考，可能不是最新状态。',
    '- 不能把模型记忆当成最终依据，优先使用检索到的参考资料。',
    '- 中文问题优先采用中国官方/中文权威来源；中文来源不足时，再用英文权威来源补充，并说明参考边界。',
  ];

  if (explicitStage) {
    lines.push(
      '- 本轮已明确给出阶段、孕周或月龄时，请以本轮描述为准，不要被历史档案覆盖。',
    );
    lines.push(
      '- 如果本轮描述和历史档案不一致，先回答当前问题，只在结尾用一句话提醒用户确认最新阶段。',
    );
  } else if (childcareScene) {
    lines.push(
      '- 本轮问题明显指向宝宝/儿童护理场景时，不要套用孕期档案或孕周信息。',
    );
  } else {
    lines.push(
      '- 若用户未明确说明阶段、孕周或月龄，可谨慎参考历史档案补充建议。',
    );
  }

  return lines.join('\n');
}

// ============================================================
// 领域决策
// ============================================================

export async function resolveDomainDecision(
  question: string,
  options: {
    userId?: string;
    context?: unknown;
    history?: Array<string | { role?: string; content?: string }>;
  },
): Promise<AIDomainDecision> {
  const initialDecision = classifyMaternalChildQuestion(question, {
    context: options.context,
    history: options.history,
  });

  if (initialDecision.status === 'in_scope' || !options.userId) {
    return initialDecision;
  }

  if (
    hasExcludedDomainSignal(question, {
      context: options.context,
      history: options.history,
    })
  ) {
    return initialDecision;
  }

  if (
    !hasHealthOrCareSignal(question, {
      context: options.context,
      history: options.history,
    })
  ) {
    return initialDecision;
  }

  const profileContext = await buildUserProfileContext(options.userId);
  const profileSignal = profileContext.retrievalHints.join('\n').trim();

  if (!profileSignal) {
    return initialDecision;
  }

  return hasMaternalChildSignal(profileSignal)
    ? { status: 'in_scope' }
    : initialDecision;
}

// ============================================================
// 知识检索 + 上下文组装
// ============================================================

export async function resolveKnowledge(
  question: string,
  userId?: string,
  userContext?: unknown,
) {
  const profileContext = await buildUserProfileContext(userId);
  const useHints = shouldUseProfileHints(question, userContext);
  const retrievalQuery = useHints
    ? [question, ...profileContext.retrievalHints].filter(Boolean).join(' ')
    : question;
  const knowledgePack = await buildKnowledgePackWithRewrite(retrievalQuery, { limit: 3 });

  return {
    profileContext,
    knowledgePack,
    finalContext: buildMergedContext(
      buildAnswerPolicy(question, userContext),
      useHints ? profileContext.prompt : undefined,
      normalizeContext(userContext),
      knowledgePack.context,
    ),
  };
}

/**
 * 判断 context 是否表示"原答案续写"模式。
 */
export function isResumeContinuationContext(context: unknown): boolean {
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    return false;
  }

  return (context as Record<string, unknown>).模式 === '原答案续写';
}
