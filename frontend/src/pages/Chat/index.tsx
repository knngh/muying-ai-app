import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { useChatStore } from '@/stores/chatStore'
import { ChatMessage } from '@/components/ChatMessage'
import { getDisclaimer } from '@/api/ai'
import styles from './Chat.module.css'

const quickQuestions = [
  '孕早期有哪些注意事项？',
  '宝宝发烧怎么办？',
  '孕期营养应该怎么补充？',
  '新生儿护理要点有哪些？',
]

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!inputValue.trim() || loading) return

    const content = inputValue.trim()
    setInputValue('')
    await sendMessage(content)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  const handleDeleteConversation = (conversationId: string) => {
    if (window.confirm('删除这段对话？')) {
      deleteConversation(conversationId)
    }
  }

  return (
    <div className={styles.chatContainer}>
      <section className={styles.header}>
        <div className={styles.headerIcon} aria-hidden="true">?</div>
        <div>
          <h1>AI 智能问答</h1>
          <p>把此刻的担心告诉我，我会陪您一起梳理。</p>
        </div>
      </section>

      <section className={styles.disclaimer}>
        <strong>重要提示</strong>
        <p>{getDisclaimer()}</p>
      </section>

      <section className={styles.messagesCard}>
        <div className={styles.historyBar}>
          <div className={styles.historyHeader}>
            <div>
              <span className={styles.historyEyebrow}>History</span>
              <strong>最近对话</strong>
            </div>
            {loadingHistory ? <span className={styles.inlineLoading}>加载中...</span> : null}
          </div>

          {conversations.length > 0 ? (
            <div className={styles.historyList}>
              {conversations.map((item) => (
                <div key={item.id} className={styles.historyItem}>
                  <button
                    type="button"
                    className={styles.historyButton}
                    onClick={() => loadHistory(item.id)}
                  >
                    <span className={styles.historyTitle}>{item.title || '新的对话'}</span>
                    <span className={styles.historySummary}>{item.summary || '暂无摘要'}</span>
                  </button>
                  <button
                    type="button"
                    className={styles.deleteButton}
                    onClick={() => handleDeleteConversation(item.id)}
                    aria-label="删除对话"
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.historyEmpty}>{loadingHistory ? '正在加载历史对话' : '还没有历史对话'}</div>
          )}
        </div>

        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyCard}>
              <strong>您好，我是母婴 AI 助手</strong>
              <p>您可以直接说说现在最担心的情况，我会尽力给您温和、清晰的参考建议。</p>
              <div className={styles.quickQuestions}>
                <span>快捷问题：</span>
                <div>
                  {quickQuestions.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => setInputValue(question)}
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.messagesList}>
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {loading ? (
              <div className={styles.loading}>
                <span className={styles.loadingDot} />
                <span>AI 正在思考...</span>
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>
        )}

        {error ? <div className={styles.errorAlert}>{error}</div> : null}
      </section>

      <section className={styles.inputCard}>
        <div className={styles.inputRow}>
          <textarea
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="请输入您的问题...（按 Enter 发送，Shift+Enter 换行）"
            className={styles.input}
            disabled={loading}
            rows={1}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={loading || !inputValue.trim()}
            className={styles.sendButton}
          >
            {loading ? '发送中' : '发送'}
          </button>
        </div>

        <div className={styles.actions}>
          <button type="button" onClick={clearMessages}>
            新对话
          </button>
        </div>
      </section>
    </div>
  )
}
