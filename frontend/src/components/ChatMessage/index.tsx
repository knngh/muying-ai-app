import type { AIMessage } from '@/api/ai'
import styles from './ChatMessage.module.css'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface ChatMessageProps {
  message: AIMessage
}

const reliabilityLabelMap = {
  authoritative: '权威来源优先',
  mixed: '权威 + 知识库',
  dataset_only: '知识库兜底',
  none: '未命中可靠来源',
} as const

const routeLabelMap = {
  trusted_rag: '可信检索',
  safety_fallback: '保守兜底',
  emergency: '紧急规则',
} as const

function getRiskLabel(riskLevel: AIMessage['riskLevel']) {
  if (riskLevel === 'red') return '红色风险'
  if (riskLevel === 'yellow') return '黄色风险'
  if (riskLevel === 'green') return '绿色风险'
  return ''
}

function getRiskClassName(riskLevel: AIMessage['riskLevel']) {
  if (riskLevel === 'red') return styles.tagRiskRed
  if (riskLevel === 'yellow') return styles.tagRiskYellow
  if (riskLevel === 'green') return styles.tagRiskGreen
  return ''
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const isEmergency = message.isEmergency
  const authorityCount = message.sources?.filter((source) => source.sourceType === 'authority' || source.authoritative).length || 0
  const wrapperClassName = `${styles.messageWrapper} ${isUser ? styles.userMessage : styles.assistantMessage}`
  const cardClassName = `${styles.messageCard} ${isEmergency ? styles.emergencyCard : ''}`

  return (
    <div className={wrapperClassName}>
      <div className={styles.avatar} aria-hidden="true">
        {isUser ? '我' : 'AI'}
      </div>
      <article className={cardClassName}>
        {isEmergency ? (
          <div className={styles.emergencyAlert}>
            <strong>紧急情况警告</strong>
            <span>如出现明显不适、持续加重或危险信号，请立即就医。</span>
          </div>
        ) : null}

        <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        </div>

        {!isUser ? (
          <div className={styles.trustPanel}>
            <div className={styles.tagGroup}>
              {message.sourceReliability ? (
                <span className={`${styles.tag} ${message.sourceReliability === 'authoritative' ? styles.tagAuthority : ''}`}>
                  {reliabilityLabelMap[message.sourceReliability]}
                </span>
              ) : null}
              {message.riskLevel ? (
                <span className={`${styles.tag} ${getRiskClassName(message.riskLevel)}`}>
                  {getRiskLabel(message.riskLevel)}
                </span>
              ) : null}
              {message.route ? (
                <span className={styles.tag}>
                  {routeLabelMap[message.route as keyof typeof routeLabelMap] || message.route}
                </span>
              ) : null}
              {message.sources?.length ? (
                <span className={styles.tag}>
                  {authorityCount > 0 ? `命中权威来源 ${authorityCount} 条` : `命中来源 ${message.sources.length} 条`}
                </span>
              ) : null}
            </div>

            {message.structuredAnswer ? (
              <div className={styles.trustSummary}>
                <strong>本轮可信判断</strong>
                <div className={styles.trustSummaryText}>{message.structuredAnswer.conclusion}</div>
                {message.structuredAnswer.actions?.length ? (
                  <ul className={styles.trustList}>
                    {message.structuredAnswer.actions.slice(0, 3).map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {message.uncertainty?.message ? (
              <div className={styles.uncertaintyAlert}>
                <strong>不确定性说明</strong>
                <span>{message.uncertainty.message}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {message.sources && message.sources.length > 0 ? (
          <div className={styles.sources}>
            <span className={styles.sourcesTitle}>参考来源：</span>
            <div className={styles.tagGroup}>
              {message.sources.map((source, index) => (
                <button
                  key={`${source.title}-${index}`}
                  type="button"
                  className={`${styles.sourceTag} ${source.url ? styles.sourceTagLink : ''}`}
                  disabled={!source.url}
                  onClick={() => {
                    if (source.url) {
                      window.open(source.url, '_blank', 'noopener,noreferrer')
                    }
                  }}
                >
                  {source.title}
                  {source.url ? ' ↗' : ''}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <time className={styles.timestamp} dateTime={message.createdAt}>
          {new Date(message.createdAt).toLocaleTimeString()}
        </time>
      </article>
    </div>
  )
}
