import type { QAMessage } from './types'
import config from './config'

const API_BASE = config.baseURL
const DISCLAIMER = '本建议仅供参考，不能替代医生诊断。如有不适请及时就医。'

/**
 * 发送问题，获取 AI 回答
 */
export function sendQuestion(question: string, history: QAMessage[]): Promise<QAMessage> {
  return fetch(`${API_BASE}/qa`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ question, history })
  })
    .then(res => res.json())
    .then(data => {
      if (data.code === 0) {
        return data.data
      }
      console.error('API Error:', data.message)
      return getMockAnswer(question)
    })
    .catch(err => {
      console.error('Fetch error:', err)
      return getMockAnswer(question)
    })
}

/**
 * 获取预设问题列表
 */
export function getPresetQuestions(): Promise<string[]> {
  return fetch(`${API_BASE}/qa/questions`)
    .then(res => res.json())
    .then(data => {
      if (data.code === 0) {
        return data.data
      }
      return getDefaultQuestions()
    })
    .catch(() => getDefaultQuestions())
}

// Mock 数据（备用）
function getMockAnswer(question: string): QAMessage {
  const id = `a-${Date.now()}`
  const sources = [{ name: '丁香妈妈 · 育儿百科' }, { name: '美国儿科学会育儿百科' }]
  const content = `根据权威资料整理：\n\n${question.includes('辅食') ? '建议6月龄左右开始添加富含铁的高铁米粉，每次一种、观察3天再换。首次少量，逐步加量。' : '建议结合宝宝月龄与体检结果，如有异常及时就医。'}\n\n参考来源：${sources.map((s) => s.name).join('、')}\n${DISCLAIMER}`
  
  return {
    id,
    role: 'assistant',
    content,
    sources,
    disclaimer: true,
    timestamp: Date.now(),
  }
}

function getDefaultQuestions(): string[] {
  return [
    '宝宝辅食应该什么时候开始添加？',
    '宝宝发烧了怎么办？',
    '婴儿湿疹如何护理？',
    '疫苗接种时间表是怎样的？',
    '宝宝需要补钙吗？'
  ]
}
