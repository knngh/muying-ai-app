import { useState, useRef, useEffect } from 'react'
import { Card, Input, Button, Space, Typography, Alert, Spin, Empty, List, Popconfirm } from 'antd'
import { SendOutlined, ClearOutlined, QuestionCircleOutlined, WarningOutlined, HistoryOutlined, DeleteOutlined } from '@ant-design/icons'
import { useChatStore } from '@/stores/chatStore'
import { ChatMessage } from '@/components/ChatMessage'
import { getDisclaimer } from '@/api/ai'
import styles from './Chat.module.css'

const { TextArea } = Input
const { Title, Text } = Typography

export function Chat() {
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const {
    messages,
    conversations,
    loading,
    loadingHistory,
    error,
    initialize,
    sendMessage,
    clearMessages,
    loadHistory,
    deleteConversation,
  } = useChatStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 发送消息
  const handleSend = async () => {
    if (!inputValue.trim() || loading) return
    
    const content = inputValue.trim()
    setInputValue('')
    await sendMessage(content)
  }

  // 按键处理
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // 快捷问题
  const quickQuestions = [
    '孕早期有哪些注意事项？',
    '宝宝发烧怎么办？',
    '孕期营养应该怎么补充？',
    '新生儿护理要点有哪些？',
  ]

  return (
    <div className={styles.chatContainer}>
      {/* 头部 */}
      <Card className={styles.header}>
        <Space>
          <QuestionCircleOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>AI 智能问答</Title>
            <Text type="secondary">专业母婴知识，随时为您解答</Text>
          </div>
        </Space>
      </Card>

      {/* 免责声明 */}
      <Alert
        type="warning"
        icon={<WarningOutlined />}
        message="重要提示"
        description={getDisclaimer()}
        showIcon
        className={styles.disclaimer}
      />

      {/* 消息列表 */}
      <Card className={styles.messagesCard}>
        <div className={styles.historyBar}>
          <Space align="center">
            <HistoryOutlined />
            <Text strong>最近对话</Text>
          </Space>

          <List
            className={styles.historyList}
            loading={loadingHistory}
            locale={{ emptyText: '还没有历史对话' }}
            dataSource={conversations}
            renderItem={(item) => (
              <List.Item
                className={styles.historyItem}
                actions={[
                  <Popconfirm
                    key="delete"
                    title="删除这段对话？"
                    okText="删除"
                    cancelText="取消"
                    onConfirm={() => deleteConversation(item.id)}
                  >
                    <Button type="text" size="small" icon={<DeleteOutlined />} />
                  </Popconfirm>,
                ]}
              >
                <button
                  type="button"
                  className={styles.historyButton}
                  onClick={() => loadHistory(item.id)}
                >
                  <span className={styles.historyTitle}>{item.title || '新的对话'}</span>
                  <span className={styles.historySummary}>{item.summary || '暂无摘要'}</span>
                </button>
              </List.Item>
            )}
          />
        </div>

        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Space direction="vertical" size="small">
                  <Text>您好！我是母婴AI助手</Text>
                  <Text type="secondary">请输入您的问题，我会尽力为您解答</Text>
                  <div className={styles.quickQuestions}>
                    <Text type="secondary">快捷问题：</Text>
                    <Space wrap>
                      {quickQuestions.map((q, i) => (
                        <Button
                          key={i}
                          size="small"
                          onClick={() => {
                            setInputValue(q)
                          }}
                        >
                          {q}
                        </Button>
                      ))}
                    </Space>
                  </div>
                </Space>
              }
            />
          </div>
        ) : (
          <div className={styles.messagesList}>
            {messages.map(msg => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {loading && (
              <div className={styles.loading}>
                <Spin tip="AI 正在思考..." />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
        
        {error && (
          <Alert
            type="error"
            message={error}
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Card>

      {/* 输入区域 */}
      <Card className={styles.inputCard}>
        <Space.Compact style={{ width: '100%' }}>
          <TextArea
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="请输入您的问题...（按 Enter 发送，Shift+Enter 换行）"
            autoSize={{ minRows: 1, maxRows: 4 }}
            className={styles.input}
            disabled={loading}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={loading}
            disabled={!inputValue.trim()}
            className={styles.sendButton}
          >
            发送
          </Button>
        </Space.Compact>
        
        <div className={styles.actions}>
          <Button 
            type="text" 
            icon={<ClearOutlined />} 
            onClick={clearMessages}
          >
            新对话
          </Button>
        </div>
      </Card>
    </div>
  )
}
