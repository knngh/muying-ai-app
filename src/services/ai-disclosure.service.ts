export interface AIServiceDisclosure {
  provider: string;
  providerName: string;
  companyName: string;
  modelName: string;
  serviceName: string;
  serviceType: string;
  publicNotice: string;
  disclaimer: string;
  filingCode?: string;
  complaintEmail?: string;
  updatedAt?: string;
}

const DEFAULT_PROVIDER = process.env.AI_DISCLOSURE_PROVIDER || process.env.AI_MINIMAX_PROVIDER || 'minimax';
const DEFAULT_PROVIDER_NAME = process.env.AI_DISCLOSURE_PROVIDER_NAME || 'MiniMax';
const DEFAULT_COMPANY_NAME = process.env.AI_DISCLOSURE_COMPANY_NAME || '上海稀宇科技有限公司';
const DEFAULT_SERVICE_NAME = process.env.AI_DISCLOSURE_SERVICE_NAME || '贝护妈妈阅读问答';
const DEFAULT_SERVICE_TYPE = process.env.AI_DISCLOSURE_SERVICE_TYPE || '生成式人工智能服务（母婴健康信息参考）';
const DEFAULT_MODEL_NAME = process.env.AI_DISCLOSURE_MODEL_NAME
  || process.env.AI_MINIMAX_MODEL
  || process.env.AI_DEFAULT_MODEL
  || 'MiniMax-M2.7';
const DEFAULT_FILING_CODE = process.env.AI_DISCLOSURE_FILING_CODE
  || process.env.AI_MINIMAX_FILING_CODE
  || 'Shanghai-Abab-20230821';
const DEFAULT_COMPLAINT_EMAIL = process.env.AI_DISCLOSURE_COMPLAINT_EMAIL || undefined;
const DEFAULT_UPDATED_AT = process.env.AI_DISCLOSURE_UPDATED_AT || '2026-04-26';

const AI_SERVICE_DISCLAIMER = process.env.AI_DISCLOSURE_DISCLAIMER
  || '本服务提供母婴健康信息参考，不提供诊断、治疗或用药决策，不能替代医生面诊；紧急情况请及时就医。';

function normalizeModelName(model?: string): string {
  if (!model || model === 'rule-based') {
    return DEFAULT_MODEL_NAME;
  }
  return model;
}

export function buildAIServiceDisclosure(model?: string, provider?: string): AIServiceDisclosure {
  const providerName = process.env.AI_DISCLOSURE_PROVIDER_NAME || DEFAULT_PROVIDER_NAME;
  const companyName = process.env.AI_DISCLOSURE_COMPANY_NAME || DEFAULT_COMPANY_NAME;
  const filingCode = process.env.AI_DISCLOSURE_FILING_CODE || process.env.AI_MINIMAX_FILING_CODE || DEFAULT_FILING_CODE;
  const modelName = normalizeModelName(process.env.AI_DISCLOSURE_MODEL_NAME || model);
  const serviceName = process.env.AI_DISCLOSURE_SERVICE_NAME || DEFAULT_SERVICE_NAME;
  const providerKey = provider && provider !== 'system' ? provider : DEFAULT_PROVIDER;

  return {
    provider: providerKey,
    providerName,
    companyName,
    modelName,
    serviceName,
    serviceType: process.env.AI_DISCLOSURE_SERVICE_TYPE || DEFAULT_SERVICE_TYPE,
    filingCode,
    complaintEmail: DEFAULT_COMPLAINT_EMAIL,
    updatedAt: DEFAULT_UPDATED_AT,
    publicNotice: process.env.AI_DISCLOSURE_PUBLIC_NOTICE
      || `${serviceName} 使用 ${providerName} 模型能力生成母婴健康信息参考；模型服务提供方：${companyName}；备案/上线编号：${filingCode || '以服务商最新公示为准'}。`,
    disclaimer: AI_SERVICE_DISCLAIMER,
  };
}
