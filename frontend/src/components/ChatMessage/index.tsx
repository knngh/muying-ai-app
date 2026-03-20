import { Typography, Card, Tag, Space, Alert } from 'antd'
import { UserOutlined, RobotOutlined, WarningOutlined, LinkOutlined } from '@ant-design/icons'
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