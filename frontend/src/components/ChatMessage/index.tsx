import { Typography, Card, Tag, Space, Alert } from 'antd'
import { UserOutlined, RobotOutlined, WarningOutlined, LinkOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import type { AIMessage } from '@/api/ai'
import styles from './ChatMessage.module.css'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const { Text } = Typography

interface ChatMessageProps {
  message: AIMessage
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const isEmergency = message.isEmergency
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
  const authorityCount = message.sources?.filter((source) => source.sourceType === 'authority' || source.authoritative).length || 0

  return (
    <div className={`${styles.messageWrapper} ${isUser ? styles.userMessage : styles.assistantMessage}`}>
      <div className={styles.avatar}>
        {isUser ? <UserOutlined /> : <RobotOutlined />}
      </div>
      <Card 
        className={`${styles.messageCard} ${isEmergency ? styles.emergencyCard : ''}`}
        styles={{ body: { padding: 16 } }}
      >
        {/* 紧急提示 */}
        {isEmergency && (
          <Alert
            type="error"
            icon={<WarningOutlined />}
            message="紧急情况警告"
            showIcon
            style={{ marginBottom: 12 }}
          />
        )}

        {/* 消息内容 */}
        <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        </div>

        {!isUser && (
          <div className={styles.trustPanel}>
            <Space wrap size={[8, 8]}>
              {message.sourceReliability && (
                <Tag color={message.sourceReliability === 'authoritative' ? 'green' : (message.sourceReliability === 'mixed' ? 'gold' : 'default')} icon={<SafetyCertificateOutlined />}>
                  {reliabilityLabelMap[message.sourceReliability]}
                </Tag>
              )}
              {message.riskLevel && (
                <Tag color={message.riskLevel === 'red' ? 'red' : (message.riskLevel === 'yellow' ? 'orange' : 'green')}>
                  {message.riskLevel === 'red' ? '红色风险' : (message.riskLevel === 'yellow' ? '黄色风险' : '绿色风险')}
                </Tag>
              )}
              {message.route && (
                <Tag>{routeLabelMap[message.route as keyof typeof routeLabelMap] || message.route}</Tag>
              )}
              {message.sources?.length ? (
                <Tag>{authorityCount > 0 ? `命中权威来源 ${authorityCount} 条` : `命中来源 ${message.sources.length} 条`}</Tag>
              ) : null}
            </Space>

            {message.structuredAnswer && (
              <div className={styles.trustSummary}>
                <Text strong>本轮可信判断</Text>
                <div className={styles.trustSummaryText}>{message.structuredAnswer.conclusion}</div>
                {message.structuredAnswer.actions?.length ? (
                  <ul className={styles.trustList}>
                    {message.structuredAnswer.actions.slice(0, 3).map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}

            {message.uncertainty?.message && (
              <Alert
                type="warning"
                showIcon
                message="不确定性说明"
                description={message.uncertainty.message}
                className={styles.uncertaintyAlert}
              />
            )}
          </div>
        )}

        {/* 来源引用 */}
        {message.sources && message.sources.length > 0 && (
          <div className={styles.sources}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              📚 参考来源：
            </Text>
            <Space wrap style={{ marginTop: 8 }}>
              {message.sources.map((source, index) => (
                <Tag 
                  key={index} 
                  color="blue"
                  icon={source.url ? <LinkOutlined /> : undefined}
                  style={{ cursor: source.url ? 'pointer' : 'default' }}
                  onClick={() => {
                    if (source.url) {
                      window.open(source.url, '_blank', 'noopener,noreferrer')
                    }
                  }}
                >
                  {source.title}
                  {source.url && ' ↗'}
                </Tag>
              ))}
            </Space>
          </div>
        )}

        {/* 时间戳 */}
        <div className={styles.timestamp}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {new Date(message.createdAt).toLocaleTimeString()}
          </Text>
        </div>
      </Card>
    </div>
  )
}
