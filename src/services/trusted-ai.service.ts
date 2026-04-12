import {
  callTaskModelDetailed,
  getEmergencyResponse,
  isEmergencyQuestion,
  type AIGatewayRouteInfo,
  type AITaskModelRole,
} from './ai-gateway.service';
import { planTrustedAIRoute, type RoutePlan } from './ai-route-planner.service';
import {
  type KnowledgeSearchResult,
  type KnowledgeRiskLevel,
  type SourceReference,
} from './knowledge.service';
import type { AIDomainDecision } from './ai-domain.service';
import {
  normalizeContext,
  getContextSignalText,
  hasExplicitStageSignal,
  hasChildcareSceneSignal,
  hasExplicitStructuredContext,
  shouldUseProfileHints,
  buildMergedContext,
  buildAnswerPolicy,
  resolveDomainDecision,
  resolveKnowledge,
  CHILDCARE_SCENE_PATTERNS,
} from './ai-context.service';
import { logger } from '../utils/logger';

export type TrustedRiskLevel = 'green' | 'yellow' | 'red';
export type TrustedTriageCategory = 'normal' | 'caution' | 'emergency' | 'out_of_scope';
export type TrustedSourceReliability = 'authoritative' | 'mixed' | 'medical_platform_only' | 'dataset_only' | 'none';

export interface TrustedStructuredAnswer {
  conclusion: string;
  reasons: string[];
  actions: string[];
  whenToSeekCare: string[];
  uncertaintyNote?: string;
}

export interface TrustedUncertaintyInfo {
  level: 'none' | 'medium' | 'high';
  message?: string;
}

export interface TrustedAIResult {
  answer: string;
  sources: SourceReference[];
  isEmergency: boolean;
  triageCategory: TrustedTriageCategory;
  riskLevel: TrustedRiskLevel;
  structuredAnswer: TrustedStructuredAnswer;
  uncertainty: TrustedUncertaintyInfo;
  sourceReliability: TrustedSourceReliability;
  disclaimer: string;
  followUpQuestions: string[];
  confidence: number;
  degraded: boolean;
  model?: string;
  provider?: string;
  route?: string;
}

export interface TrustedAIRequest {
  question: string;
  context?: unknown;
  userId?: string;
  model?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

const AI_DISCLAIMER = '温馨提示：本回答用于母婴健康信息参考，不能替代医生面诊、检查和专业判断。';
const EMERGENCY_DISCLAIMER = '重要提示：当前命中高风险规则，请优先立即线下就医。';
const CLARIFICATION_DISCLAIMER = '当前缺少足够的权威依据，问题助手已暂停继续生成，请先补充关键信息或直接线下就医。';
const OUT_OF_SCOPE_DISCLAIMER = '当前仅支持母婴、孕产、喂养、护理、成长发育相关问题。';
const DATASET_ONLY_NOTICE = '当前检索结果主要来自内部知识库或公开问答数据，不属于权威临床指南，不能替代线下面诊。';
const MEDICAL_PLATFORM_NOTICE = '当前检索结果包含第三方医学平台内容，可作为辅助参考，但不等同于官方指南或临床规范。';

// Pattern 定义已统一到 ai-context.service.ts

const RED_RISK_PATTERNS = [
  /大出血|出血不止|流血不止/u,
  /呼吸困难|喘不上气|口唇发紫/u,
  /抽搐|惊厥|意识异常|昏迷|反应差/u,
  /胎动消失|没有胎动|胎动明显减少/u,
  /破水|羊水破了/u,
  /剧烈腹痛|持续剧痛/u,
  /新生儿.{0,8}(拒奶|呼吸困难|发青|抽搐|反应差)/u,
];

const YELLOW_RISK_PATTERNS = [
  /发烧|发热|高热|咳嗽|腹泻|拉肚子|呕吐|便血|便秘|黄疸|湿疹|皮疹|过敏/u,
  /见红|出血|腹痛|宫缩|胎动减少/u,
  /奶量下降|拒奶|精神差|尿少|脱水/u,
  /用药|药量|退烧药|抗生素|处方药|检查单|化验单|B超|彩超|CT|指标/u,
];

// normalizeContext, getContextSignalText, hasExplicitStageSignal, hasChildcareSceneSignal,
// hasExplicitStructuredContext, shouldUseProfileHints, buildAnswerPolicy, buildMergedContext,
// resolveDomainDecision, resolveKnowledge 已统一到 ai-context.service.ts

function inferSourceReliability(sources: SourceReference[]): TrustedSourceReliability {
  if (sources.length === 0) {
    return 'none';
  }

  const authoritativeCount = sources.filter((source) => source.authoritative).length;
  const medicalPlatformCount = sources.filter((source) => source.sourceClass === 'medical_platform' || source.sourceType === 'editorial').length;
  if (authoritativeCount === sources.length) {
    return 'authoritative';
  }

  if (authoritativeCount > 0) {
    return 'mixed';
  }

  if (medicalPlatformCount > 0) {
    return 'medical_platform_only';
  }

  return 'dataset_only';
}

function getSourceLabel(source: SourceReference): string {
  if (source.sourceClass === 'official' || source.sourceType === 'authority') {
    return '权威来源';
  }

  if (source.sourceClass === 'medical_platform' || source.sourceType === 'editorial') {
    return '平台医学内容';
  }

  if (source.sourceClass === 'dataset' || source.sourceType === 'dataset') {
    return '数据集/知识库';
  }

  return '一般来源';
}

function determineRiskLevel(question: string, context: unknown, results: KnowledgeSearchResult[]): TrustedRiskLevel {
  const signalText = [question, getContextSignalText(context)].filter(Boolean).join('\n');

  if (RED_RISK_PATTERNS.some((pattern) => pattern.test(signalText)) || isEmergencyQuestion(signalText)) {
    return 'red';
  }

  if (YELLOW_RISK_PATTERNS.some((pattern) => pattern.test(signalText))) {
    return 'yellow';
  }

  const resultRiskLevels = results
    .map((item) => item.sourceReference.riskLevelDefault)
    .filter((level): level is KnowledgeRiskLevel => Boolean(level));

  if (resultRiskLevels.includes('red')) {
    return 'red';
  }

  if (resultRiskLevels.includes('yellow')) {
    return 'yellow';
  }

  return 'green';
}

function buildUncertainty(
  sourceReliability: TrustedSourceReliability,
  sources: SourceReference[],
  question: string,
): TrustedUncertaintyInfo {
  if (sources.length === 0) {
    return {
      level: 'high',
      message: '当前没有检索到可支撑判断的参考来源，无法安全给出更具体的建议。',
    };
  }

  if (sourceReliability === 'dataset_only') {
    return {
      level: 'high',
      message: DATASET_ONLY_NOTICE,
    };
  }

  if (sourceReliability === 'medical_platform_only') {
    return {
      level: 'medium',
      message: MEDICAL_PLATFORM_NOTICE,
    };
  }

  if (sourceReliability === 'mixed') {
    return {
      level: 'medium',
      message: '当前回答同时参考了权威来源和一般知识条目，如症状明显或持续加重，应以线下医生判断为准。',
    };
  }

  if (/检查单|化验单|报告|B超|彩超|CT|核磁/u.test(question)) {
    return {
      level: 'medium',
      message: '涉及检查结果解读时，线上信息只能辅助理解，不能替代医生结合体征和病史的正式判断。',
    };
  }

  return { level: 'none' };
}

function extractStructuredAnswerJson(raw: string): TrustedStructuredAnswer | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const withoutFence = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const firstBrace = withoutFence.indexOf('{');
  const lastBrace = withoutFence.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  const candidate = withoutFence.slice(firstBrace, lastBrace + 1);

  try {
    const parsed = JSON.parse(candidate) as {
      conclusion?: unknown;
      reasons?: unknown;
      actions?: unknown;
      when_to_seek_care?: unknown;
      uncertainty_note?: unknown;
    };

    return {
      conclusion: typeof parsed.conclusion === 'string' ? parsed.conclusion.trim() : '',
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons.map((item) => String(item).trim()).filter(Boolean) : [],
      actions: Array.isArray(parsed.actions) ? parsed.actions.map((item) => String(item).trim()).filter(Boolean) : [],
      whenToSeekCare: Array.isArray(parsed.when_to_seek_care)
        ? parsed.when_to_seek_care.map((item) => String(item).trim()).filter(Boolean)
        : [],
      uncertaintyNote: typeof parsed.uncertainty_note === 'string' ? parsed.uncertainty_note.trim() : undefined,
    };
  } catch {
    return null;
  }
}

function dedupeLines(lines: string[]): string[] {
  return Array.from(new Set(lines.map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean)));
}

function buildFallbackActions(question: string, riskLevel: TrustedRiskLevel): string[] {
  if (/发烧|发热|高热/u.test(question)) {
    return dedupeLines([
      '先记录体温、精神状态、吃奶/进食和尿量变化。',
      '避免自行叠加用药或反复更换处理方式。',
      riskLevel === 'red' ? '不要继续居家等待，直接就医。' : '若体温持续升高或状态变差，尽快线下就医。',
    ]).slice(0, 3);
  }

  if (/出血|见红|流血/u.test(question)) {
    return dedupeLines([
      '记录出血量、颜色、持续时间以及是否伴随腹痛。',
      '减少不必要活动，不要自行处理或拖延观察。',
      riskLevel === 'red' ? '立即前往急诊或产科。' : '若量增多、颜色鲜红或伴腹痛，尽快就医。',
    ]).slice(0, 3);
  }

  if (/腹泻|拉肚子|呕吐|脱水/u.test(question)) {
    return dedupeLines([
      '关注进食、饮水、尿量和精神状态。',
      '先避免自行使用不明确药物。',
      '若出现明显脱水、尿少或精神差，尽快就医。',
    ]).slice(0, 3);
  }

  if (/咳嗽|呼吸|喘/u.test(question)) {
    return dedupeLines([
      '先观察呼吸是否费力、是否有喘憋或发青。',
      '记录症状持续时间以及是否影响吃奶/进食和睡眠。',
      riskLevel === 'red' ? '立即线下就医。' : '若呼吸加快、凹陷呼吸或精神差，尽快就医。',
    ]).slice(0, 3);
  }

  return dedupeLines([
    '先补充症状持续时间、对象阶段（孕周或月龄）和精神状态等关键信息。',
    '避免把线上信息当成诊断结论，也不要自行尝试高风险处理。',
    riskLevel === 'red' ? '现阶段以立即就医为先。' : '若症状持续、加重或您明显不放心，尽快线下就医。',
  ]).slice(0, 3);
}

function buildFallbackSeekCare(question: string, riskLevel: TrustedRiskLevel): string[] {
  if (riskLevel === 'red') {
    return ['现在就医，不建议继续线上等待或居家观察。'];
  }

  const lines = [
    '出现呼吸困难、抽搐、意识异常、大量出血等情况时立即就医。',
  ];

  if (/发烧|发热|高热/u.test(question)) {
    lines.push('体温持续升高、精神差、拒奶/拒食、尿量减少时尽快就医。');
  } else if (/出血|见红|流血/u.test(question)) {
    lines.push('出血量增多、颜色鲜红或伴明显腹痛时尽快就医。');
  } else {
    lines.push('症状持续不缓解、明显加重或出现新的高危信号时尽快就医。');
  }

  return dedupeLines(lines).slice(0, 3);
}

function buildFallbackReasons(results: KnowledgeSearchResult[], question: string, riskLevel: TrustedRiskLevel): string[] {
  const fromSources = results
    .slice(0, 2)
    .map((item) => item.sourceReference.excerpt || item.answer.replace(/\s+/g, ' ').slice(0, 80))
    .filter(Boolean)
    .map((text) => String(text).trim());

  if (fromSources.length > 0) {
    return dedupeLines(fromSources).slice(0, 3);
  }

  if (riskLevel === 'red') {
    return ['问题描述中包含高风险信号，线上信息无法替代急诊或专科现场评估。'];
  }

  if (/检查单|化验单|报告/u.test(question)) {
    return ['仅凭文字描述无法安全完成检查结果解读，仍需结合病史、体征和医生面诊。'];
  }

  return ['当前只能基于有限信息给出保守建议，无法把线上答复当作诊断或治疗方案。'];
}

function buildFallbackStructuredAnswer(params: {
  question: string;
  riskLevel: TrustedRiskLevel;
  triageCategory: TrustedTriageCategory;
  results: KnowledgeSearchResult[];
  uncertainty: TrustedUncertaintyInfo;
}): TrustedStructuredAnswer {
  const { question, riskLevel, triageCategory, results, uncertainty } = params;

  if (triageCategory === 'emergency') {
    return {
      conclusion: '这类情况属于高风险，现阶段最重要的是立即线下就医，而不是继续在线上详细分析。',
      reasons: ['问题描述中包含可能危及孕妇或宝宝安全的危险信号。'],
      actions: [
        '立即前往急诊、产科急诊或儿科急诊；必要时直接拨打 120。',
        '带上既往检查结果、用药信息和症状发生时间。',
      ],
      whenToSeekCare: ['现在就医，不建议继续居家观察。'],
      uncertaintyNote: '线上信息不能替代急诊评估，系统已优先触发安全止损。',
    };
  }

  if (triageCategory === 'out_of_scope') {
    return {
      conclusion: '当前问题不在母婴问题助手的支持范围内。',
      reasons: ['系统目前只回答备孕、孕期、产后、喂养、护理、发育和常见母婴症状相关问题。'],
      actions: ['请改用母婴相关表述重新提问，或直接咨询对应专业人士。'],
      whenToSeekCare: ['若现实中已经存在明显不适或急症，请直接线下就医。'],
      uncertaintyNote: '超出范围时，系统不会继续猜测或强行生成答案。',
    };
  }

  const conclusion = triageCategory === 'caution'
    ? '当前更适合先做谨慎观察，并结合升级条件决定是否尽快线下就医。'
    : '从现有信息看，更接近常见母婴知识或护理问题，但仍应按稳妥方式处理。';

  return {
    conclusion,
    reasons: buildFallbackReasons(results, question, riskLevel),
    actions: buildFallbackActions(question, riskLevel),
    whenToSeekCare: buildFallbackSeekCare(question, riskLevel),
    uncertaintyNote: uncertainty.message,
  };
}

function sanitizeStructuredAnswer(
  candidate: TrustedStructuredAnswer | null,
  fallback: TrustedStructuredAnswer,
  uncertainty: TrustedUncertaintyInfo,
): TrustedStructuredAnswer {
  if (!candidate) {
    return fallback;
  }

  const conclusion = candidate.conclusion.trim() || fallback.conclusion;
  const reasons = dedupeLines(candidate.reasons).slice(0, 3);
  const actions = dedupeLines(candidate.actions).slice(0, 3);
  const whenToSeekCare = dedupeLines(candidate.whenToSeekCare).slice(0, 3);

  return {
    conclusion,
    reasons: reasons.length > 0 ? reasons : fallback.reasons,
    actions: actions.length > 0 ? actions : fallback.actions,
    whenToSeekCare: whenToSeekCare.length > 0 ? whenToSeekCare : fallback.whenToSeekCare,
    uncertaintyNote: candidate.uncertaintyNote?.trim() || fallback.uncertaintyNote || uncertainty.message,
  };
}

function renderSources(sources: SourceReference[]): string[] {
  if (sources.length === 0) {
    return ['- 当前未检索到可用来源，系统已按保守规则处理，无法安全给出更具体判断。'];
  }

  return sources.slice(0, 3).map((source) => {
    const details = [
      source.sourceOrg || source.source,
      getSourceLabel(source),
      source.updatedAt ? `更新于 ${source.updatedAt.slice(0, 10)}` : undefined,
    ].filter(Boolean).join(' · ');

    return `- ${source.title}（${details}）`;
  });
}

function renderStructuredAnswer(answer: TrustedStructuredAnswer, sources: SourceReference[]): string {
  const sections = [
    '结论',
    answer.conclusion,
    '',
    '原因',
    ...(answer.reasons.length > 0 ? answer.reasons.map((item) => `- ${item}`) : ['- 当前信息有限，系统仅能给出保守说明。']),
    '',
    '建议动作',
    ...(answer.actions.length > 0 ? answer.actions.map((item) => `- ${item}`) : ['- 请补充更多关键信息或尽快就医。']),
    '',
    '何时就医',
    ...(answer.whenToSeekCare.length > 0 ? answer.whenToSeekCare.map((item) => `- ${item}`) : ['- 如症状明显、持续加重或您明显不放心，请尽快就医。']),
  ];

  if (answer.uncertaintyNote) {
    sections.push('', '不确定性说明', answer.uncertaintyNote);
  }

  sections.push('', '参考来源', ...renderSources(sources));
  return sections.join('\n');
}

function buildReferencePrompt(sources: SourceReference[]): string {
  if (sources.length === 0) {
    return '未检索到可用来源。';
  }

  return sources.slice(0, 3).map((source, index) => {
    return [
      `[参考 ${index + 1}]`,
      `标题：${source.title}`,
      `来源机构：${source.sourceOrg || source.source}`,
      `来源类型：${source.sourceType || 'unknown'}`,
      `来源层级：${source.sourceClass || 'unknown'}`,
      `主题：${source.topic || source.category || '未知'}`,
      `默认风险：${source.riskLevelDefault || 'yellow'}`,
      `更新时间：${source.updatedAt || '未知'}`,
      `摘录：${source.excerpt || '无'}`,
    ].join('\n');
  }).join('\n\n');
}

function buildHistoryPrompt(history?: Array<{ role: 'user' | 'assistant'; content: string }>): string {
  if (!history || history.length === 0) {
    return '无历史对话。';
  }

  return history
    .slice(-6)
    .map((message) => `${message.role === 'user' ? '用户' : '助手'}：${message.content}`)
    .join('\n');
}

function buildStructuredAnswerPayload(answer: TrustedStructuredAnswer): string {
  return JSON.stringify({
    conclusion: answer.conclusion,
    reasons: answer.reasons,
    actions: answer.actions,
    when_to_seek_care: answer.whenToSeekCare,
    uncertainty_note: answer.uncertaintyNote || '',
  }, null, 2);
}

function buildTaskModelMessages(params: {
  taskRole: AITaskModelRole;
  question: string;
  context?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  plan: RoutePlan;
  riskLevel: TrustedRiskLevel;
  triageCategory: TrustedTriageCategory;
  sourceReliability: TrustedSourceReliability;
  sources: SourceReference[];
  fallbackStructured: TrustedStructuredAnswer;
  currentDraft: TrustedStructuredAnswer;
}): Array<{ role: 'system' | 'user'; content: string }> {
  const taskInstructionMap: Record<AITaskModelRole, string[]> = {
    glm_classify: [
      '你负责低成本分类/澄清层。',
      '如果信息不足或来源弱，请优先输出需要补充的信息，而不是自由发挥。',
      '必要时可以先把检索信息压缩成简短结论，但不要扩写成长文，不要做确诊，不要给剂量。',
    ],
    kimi_reason: [
      '你负责高质量理解整合层。',
      '基于已有资料和中间草稿做条件判断与多来源归纳。',
      '如果资料不够，必须明确保守边界。',
    ],
    minimax_render: [
      '你负责最终中文表达层。',
      '在不改变安全边界和动作建议的前提下，让表达更自然、更适合用户阅读。',
      '不要新增未在草稿中出现的高风险动作或诊断结论。',
    ],
  };

  const systemPrompt = [
    '你在执行母婴可信 AI 的固定任务链。',
    `当前任务角色：${params.taskRole}`,
    '只允许输出一个 JSON 对象，不要输出 Markdown、代码块、解释或额外文字。',
    'JSON 必须严格包含这些键：conclusion, reasons, actions, when_to_seek_care, uncertainty_note。',
    '其中 reasons/actions/when_to_seek_care 都必须是字符串数组，每个数组 1 到 3 条。',
    '回答原则：',
    '- 优先服从 triage_category 和 risk_level。',
    '- 不得把模型记忆伪装成权威来源，不得编造来源。',
    '- 不要给出具体药物剂量、处方、诊断结论或确定性病名判断。',
    '- red 风险时，不要展开病因分析，直接突出立即就医动作。',
    '- 如果当前来源不是权威指南，uncertainty_note 必须明确说明这一点。',
    '- 如果信息不足，明确表达无法安全判断。',
    ...taskInstructionMap[params.taskRole],
  ].join('\n');

  const userPrompt = [
    `triage_category: ${params.triageCategory}`,
    `risk_level: ${params.riskLevel}`,
    `source_reliability: ${params.sourceReliability}`,
    `retrieval_tier: ${params.plan.retrievalTier}`,
    `complexity: ${params.plan.complexity}`,
    `route_reason: ${params.plan.reason}`,
    '',
    `当前问题：${params.question}`,
    '',
    '补充上下文：',
    params.context || '无',
    '',
    '历史对话：',
    buildHistoryPrompt(params.history),
    '',
    '参考资料：',
    buildReferencePrompt(params.sources),
    '',
    '系统兜底草稿：',
    buildStructuredAnswerPayload(params.fallbackStructured),
    '',
    '当前链路草稿：',
    buildStructuredAnswerPayload(params.currentDraft),
  ].join('\n');

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}

async function executePlannedGeneration(params: {
  question: string;
  finalContext?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  plan: RoutePlan;
  riskLevel: TrustedRiskLevel;
  triageCategory: TrustedTriageCategory;
  sourceReliability: TrustedSourceReliability;
  sources: SourceReference[];
  fallbackStructured: TrustedStructuredAnswer;
  uncertainty: TrustedUncertaintyInfo;
}): Promise<{
  structuredAnswer: TrustedStructuredAnswer;
  degraded: boolean;
  routeInfo?: AIGatewayRouteInfo;
  routeSummary: string;
}> {
  let currentDraft = params.fallbackStructured;
  let degraded = false;
  let lastRouteInfo: AIGatewayRouteInfo | undefined;
  const executedSteps: string[] = [];

  for (const step of params.plan.executionPlan) {
    if (step === 'system') {
      executedSteps.push('system');
      continue;
    }

    try {
      const result = await callTaskModelDetailed(
        step,
        buildTaskModelMessages({
          taskRole: step,
          question: params.question,
          context: params.finalContext,
          history: params.history,
          plan: params.plan,
          riskLevel: params.riskLevel,
          triageCategory: params.triageCategory,
          sourceReliability: params.sourceReliability,
          sources: params.sources,
          fallbackStructured: params.fallbackStructured,
          currentDraft,
        }),
        {
          temperature: step === 'minimax_render' ? 0.35 : 0.15,
          maxTokens: step === 'glm_classify' ? 900 : 1200,
        },
      );

      currentDraft = sanitizeStructuredAnswer(
        extractStructuredAnswerJson(result.answer),
        currentDraft,
        params.uncertainty,
      );
      lastRouteInfo = result.route;
      executedSteps.push(step);
    } catch (error) {
      degraded = true;
      executedSteps.push(`${step}:fallback`);
      logger.error('trusted_ai.step_failed', {
        component: 'trusted-ai.service',
        event: 'task_step_failed',
        step,
        err: error,
      });
    }
  }

  return {
    structuredAnswer: currentDraft,
    degraded,
    routeInfo: lastRouteInfo,
    routeSummary: `${params.plan.executionPlan.join('>')}|${params.plan.retrievalTier}|${params.plan.complexity}|${executedSteps.join('>')}`,
  };
}

function estimateConfidence(
  sources: SourceReference[],
  sourceReliability: TrustedSourceReliability,
  riskLevel: TrustedRiskLevel,
): number {
  if (sources.length === 0) {
    return 0.22;
  }

  const base = Math.min(0.3 + (sources[0]?.relevance || 0) * 0.5, 0.82);
  const reliabilityBoost = sourceReliability === 'authoritative'
    ? 0.12
    : (sourceReliability === 'mixed' ? 0.04 : (sourceReliability === 'medical_platform_only' ? -0.02 : -0.1));
  const riskPenalty = riskLevel === 'green' ? 0 : (riskLevel === 'yellow' ? -0.08 : -0.16);

  return Math.max(0.2, Math.min(0.92, Number((base + reliabilityBoost + riskPenalty).toFixed(2))));
}

function buildDomainResult(decision: AIDomainDecision): TrustedAIResult {
  const triageCategory: TrustedTriageCategory = decision.status === 'needs_clarification' ? 'caution' : 'out_of_scope';
  const riskLevel: TrustedRiskLevel = decision.status === 'needs_clarification' ? 'yellow' : 'green';
  const uncertainty: TrustedUncertaintyInfo = {
    level: 'high',
    message: decision.status === 'needs_clarification'
      ? '对象、孕周/月龄或症状关键信息不足，当前不适合继续猜测。'
      : '超出支持范围时，系统不会继续生成看似完整但不可靠的答案。',
  };
  const structuredAnswer = buildFallbackStructuredAnswer({
    question: '',
    riskLevel,
    triageCategory,
    results: [],
    uncertainty,
  });
  const adjustedStructuredAnswer: TrustedStructuredAnswer = {
    ...structuredAnswer,
    conclusion: decision.status === 'needs_clarification'
      ? '当前信息不足，系统暂时无法安全判断。'
      : '当前问题不在母婴问题助手的支持范围内。',
    reasons: decision.answer
      ? decision.answer.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 3)
      : structuredAnswer.reasons,
  };

  return {
    answer: renderStructuredAnswer(adjustedStructuredAnswer, []),
    sources: [],
    isEmergency: false,
    triageCategory,
    riskLevel,
    structuredAnswer: adjustedStructuredAnswer,
    uncertainty,
    sourceReliability: 'none',
    disclaimer: decision.status === 'needs_clarification' ? CLARIFICATION_DISCLAIMER : OUT_OF_SCOPE_DISCLAIMER,
    followUpQuestions: [],
    confidence: 0.18,
    degraded: false,
    provider: 'system',
    route: decision.status,
    model: 'rule-based',
  };
}

export async function generateTrustedAIResponse(request: TrustedAIRequest): Promise<TrustedAIResult> {
  const question = request.question.trim();
  const domainDecision = await resolveDomainDecision(question, {
    userId: request.userId,
    context: request.context,
    history: request.history,
  });

  if (domainDecision.status !== 'in_scope') {
    return buildDomainResult(domainDecision);
  }

  const { knowledgePack, finalContext } = await resolveKnowledge(question, request.userId, request.context);
  const riskLevel = determineRiskLevel(question, request.context, knowledgePack.results);
  const triageCategory: TrustedTriageCategory = riskLevel === 'red' ? 'emergency' : (riskLevel === 'yellow' ? 'caution' : 'normal');
  const sourceReliability = inferSourceReliability(knowledgePack.sources);
  const routePlan = planTrustedAIRoute({
    question,
    userId: request.userId,
    riskLevel,
    triageCategory,
    sources: knowledgePack.sources,
    sourceReliability,
  });
  const uncertainty = buildUncertainty(sourceReliability, knowledgePack.sources, question);
  const fallbackStructured = buildFallbackStructuredAnswer({
    question,
    riskLevel,
    triageCategory,
    results: knowledgePack.results,
    uncertainty,
  });

  if (triageCategory === 'emergency') {
    const structuredAnswer = {
      ...fallbackStructured,
      conclusion: '这类情况属于高风险，现阶段最重要的是立即就医，而不是继续线上详细分析。',
    };

    return {
      answer: renderStructuredAnswer(structuredAnswer, knowledgePack.sources),
      sources: knowledgePack.sources,
      isEmergency: true,
      triageCategory,
      riskLevel,
      structuredAnswer,
      uncertainty: {
        level: 'high',
        message: '高风险问题已触发快速止损，系统不会继续展开细节分析。',
      },
      sourceReliability,
      disclaimer: EMERGENCY_DISCLAIMER,
      followUpQuestions: [],
      confidence: estimateConfidence(knowledgePack.sources, sourceReliability, riskLevel),
      degraded: false,
      provider: 'system',
      route: 'emergency',
      model: 'rule-based',
    };
  }

  if (knowledgePack.sources.length === 0) {
    const structuredAnswer = {
      ...fallbackStructured,
      conclusion: '当前没有检索到可支撑判断的权威来源，系统已拦截继续生成，暂不提供更具体的结论。',
    };

    return {
      answer: renderStructuredAnswer(structuredAnswer, knowledgePack.sources),
      sources: knowledgePack.sources,
      isEmergency: false,
      triageCategory,
      riskLevel,
      structuredAnswer,
      uncertainty,
      sourceReliability,
      disclaimer: CLARIFICATION_DISCLAIMER,
      followUpQuestions: knowledgePack.followUpQuestions,
      confidence: estimateConfidence(knowledgePack.sources, sourceReliability, riskLevel),
      degraded: true,
      provider: 'system',
      route: 'knowledge-miss',
      model: 'rule-based',
    };
  }

  const generation = await executePlannedGeneration({
    question,
    finalContext,
    history: request.history,
    plan: routePlan,
    riskLevel,
    triageCategory,
    sourceReliability,
    sources: knowledgePack.sources,
    fallbackStructured,
    uncertainty,
  });
  const structuredAnswer = generation.structuredAnswer;
  const degraded = generation.degraded;

  if (!structuredAnswer.uncertaintyNote) {
    if (sourceReliability === 'medical_platform_only') {
      structuredAnswer.uncertaintyNote = MEDICAL_PLATFORM_NOTICE;
    } else if (sourceReliability === 'dataset_only' || sourceReliability === 'none') {
      structuredAnswer.uncertaintyNote = DATASET_ONLY_NOTICE;
    }
  }

  return {
    answer: renderStructuredAnswer(structuredAnswer, knowledgePack.sources),
    sources: knowledgePack.sources,
    isEmergency: false,
    triageCategory,
    riskLevel,
    structuredAnswer,
    uncertainty,
    sourceReliability,
    disclaimer: sourceReliability === 'authoritative'
      ? AI_DISCLAIMER
      : `${AI_DISCLAIMER} ${sourceReliability === 'medical_platform_only' ? MEDICAL_PLATFORM_NOTICE : DATASET_ONLY_NOTICE}`,
    followUpQuestions: triageCategory === 'normal' ? knowledgePack.followUpQuestions : knowledgePack.followUpQuestions.slice(0, 2),
    confidence: estimateConfidence(knowledgePack.sources, sourceReliability, riskLevel),
    degraded,
    model: generation.routeInfo?.model || request.model || 'rule-based',
    provider: generation.routeInfo?.provider || (degraded ? 'system' : undefined),
    route: generation.routeInfo?.route
      ? `${generation.routeInfo.route}:${generation.routeSummary}`
      : (degraded ? `fallback:${generation.routeSummary}` : generation.routeSummary),
  };
}

export function chunkTrustedAnswer(answer: string, maxChunkLength = 90): string[] {
  const normalized = answer.trim();
  if (!normalized) {
    return [];
  }

  const lines = normalized.split('\n');
  const chunks: string[] = [];
  let current = '';

  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length <= maxChunkLength || current.length === 0) {
      current = candidate;
      continue;
    }

    chunks.push(current);
    current = line;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

export function buildTrustedEmergencyPreview(): string {
  return getEmergencyResponse();
}
