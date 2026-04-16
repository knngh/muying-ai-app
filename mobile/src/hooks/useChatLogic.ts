import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { useChatStore } from '../stores/chatStore'
import { useMembershipStore } from '../stores/membershipStore'
import type { MembershipPlan } from '../stores/membershipStore'

export function useChatLogic() {
  const {
    messages,
    loading,
    loadingHistory,
    streamingContent,
    error,
    isQuotaExceeded,
    initialize,
    sendMessage,
    startFreshSession,
    clearMessages,
  } = useChatStore()
  const {
    status,
    currentPlanCode,
    aiUsedToday,
    aiLimit,
    plans,
    ensureFreshQuota,
    consumeAiQuota,
    purchasePlan,
    loading: membershipLoading,
  } = useMembershipStore()

  const [upgradeVisible, setUpgradeVisible] = useState(false)

  useEffect(() => {
    initialize()
  }, [initialize])

  useFocusEffect(
    useCallback(() => {
      ensureFreshQuota()
    }, [ensureFreshQuota]),
  )

  useEffect(() => {
    if (isQuotaExceeded) {
      setUpgradeVisible(true)
      ensureFreshQuota()
    }
  }, [ensureFreshQuota, isQuotaExceeded])

  const activePlan = useMemo(
    () => plans.find((item: MembershipPlan) => item.code === currentPlanCode),
    [currentPlanCode, plans],
  )

  const remainingCount = status === 'active' ? '无限次' : `${Math.max(aiLimit - aiUsedToday, 0)} 次`

  const checkQuota = useCallback(() => {
    const result = consumeAiQuota()
    if (!result.allowed) {
      setUpgradeVisible(true)
      return false
    }
    return true
  }, [consumeAiQuota])

  const handleSend = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || loading) return false
      if (!checkQuota()) return false
      sendMessage(trimmed)
      return true
    },
    [checkQuota, loading, sendMessage],
  )

  const handleQuickQuestion = useCallback(
    (question: string) => {
      if (loading) return false
      if (!checkQuota()) return false
      sendMessage(question)
      return true
    },
    [checkQuota, loading, sendMessage],
  )

  const handleUpgrade = async (code: 'monthly' | 'quarterly' | 'yearly') => {
    try {
      await purchasePlan(code)
      setUpgradeVisible(false)
    } catch (_error) {
      setUpgradeVisible(true)
    }
  }

  return {
    messages,
    loading,
    loadingHistory,
    streamingContent,
    error,
    status,
    plans,
    membershipLoading,
    activePlan,
    remainingCount,
    upgradeVisible,
    setUpgradeVisible,
    handleSend,
    handleQuickQuestion,
    handleUpgrade,
    clearMessages,
    startFreshSession,
  }
}
