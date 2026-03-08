import type { QAMessage } from './types'

const DISCLAIMER = '本建议仅供参考，不能替代医生诊断。如有不适请及时就医。'
const SOURCE_PREFIX = '参考来源：'

/** 发送问题，获取 AI 回答（后续对接 RAG/预设问答库） */
export function sendQuestion(question: string, history: QAMessage[]): Promise<QAMessage> {
  const id = `a-${Date.now()}`
  const sources = [{ name: '丁香妈妈 · 育儿百科' }, { name: '美国儿科学会育儿百科' }]
  const content = `根据权威资料整理：\n\n${question.includes('辅食') ? '建议6月龄左右开始添加富含铁的高铁米粉，每次一种、观察3天再换。首次少量，逐步加量。' : '建议结合宝宝月龄与体检结果，如有异常及时就医。'}\n\n${SOURCE_PREFIX}${sources.map((s) => s.name).join('、')}\n${DISCLAIMER}`
  return Promise.resolve({
    id,
    role: 'assistant',
    content,
    sources,
    disclaimer: true,
    timestamp: Date.now(),
  })
}
