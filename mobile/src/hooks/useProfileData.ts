import { useCallback, useMemo, useState } from 'react'
import { Alert } from 'react-native'
import { CommonActions, useNavigation } from '@react-navigation/native'
import { useFocusEffect } from '@react-navigation/native'
import dayjs from 'dayjs'
import { authApi } from '../api/modules'
import { useAppStore } from '../stores/appStore'
import { useChatStore } from '../stores/chatStore'
import { useMembershipStore } from '../stores/membershipStore'
import type { MembershipPlan } from '../stores/membershipStore'
import { getStageSummary } from '../utils/stage'
import { sessionStorage } from '../utils/storage'

const PREGNANCY_STATUS_TO_CODE: Record<string, number> = {
  备孕中: 1,
  孕期中: 2,
  产后: 3,
}

const BABY_GENDER_TO_CODE: Record<string, number> = {
  男: 1,
  女: 2,
  未知: 0,
}

function getPregnancyStatusLabel(value?: string | number | null): string {
  if (value === 1 || value === '1' || value === 'preparing') return '备孕中'
  if (value === 2 || value === '2' || value === 'pregnant') return '孕期中'
  if (value === 3 || value === '3' || value === 'postpartum') return '产后'
  return '未设置'
}

function getBabyGenderLabel(value?: string | number | null): string {
  if (value === 1 || value === '1' || value === 'male') return '男'
  if (value === 2 || value === '2' || value === 'female') return '女'
  if (value === 0 || value === '0' || value === 'unknown') return '未知'
  return '未设置'
}

export function useProfileData() {
  const navigation = useNavigation<any>()
  const { user, setToken, setUser } = useAppStore()
  const resetChatState = useChatStore((state) => state.resetState)
  const resetMembershipState = useMembershipStore((state) => state.resetState)
  const {
    status,
    currentPlanCode,
    expireAt,
    aiUsedToday,
    aiLimit,
    plans,
    weeklyReports,
    checkInStreak,
    weeklyCompletionRate,
    hydrated,
    ensureFreshQuota,
  } = useMembershipStore()

  const [editModalVisible, setEditModalVisible] = useState(false)
  const [formNickname, setFormNickname] = useState('')
  const [formPregnancyStatus, setFormPregnancyStatus] = useState('备孕中')
  const [formDueDate, setFormDueDate] = useState('')
  const [formBabyBirthday, setFormBabyBirthday] = useState('')
  const [formBabyGender, setFormBabyGender] = useState('未知')
  const [snackMessage, setSnackMessage] = useState('')

  const stage = useMemo(() => getStageSummary(user), [user])
  const activePlan = useMemo(
    () => plans.find((item: MembershipPlan) => item.code === currentPlanCode),
    [currentPlanCode, plans],
  )

  useFocusEffect(
    useCallback(() => {
      ensureFreshQuota()
    }, [ensureFreshQuota]),
  )

  const maskedPhone = useMemo(() => {
    const phone = user?.phone ?? ''
    if (phone.length >= 7) {
      return `${phone.slice(0, 3)}****${phone.slice(7)}`
    }
    return phone || '未设置'
  }, [user?.phone])

  const maskedEmail = useMemo(() => {
    const email = user?.email ?? ''
    const [name, domain] = email.split('@')
    if (!name || !domain) return email || '未设置'
    if (name.length <= 2) return `${name[0] || '*'}***@${domain}`
    return `${name.slice(0, 2)}***@${domain}`
  }, [user?.email])

  const accountRows = useMemo(
    () => [
      { label: '用户名', value: user?.username ?? '未设置' },
      { label: '手机号', value: maskedPhone },
      { label: '邮箱', value: maskedEmail },
      { label: '孕育状态', value: getPregnancyStatusLabel(user?.pregnancyStatus) },
      {
        label: '预产期',
        value: user?.dueDate ? dayjs(user.dueDate).format('YYYY-MM-DD') : '未设置',
      },
      {
        label: '宝宝生日',
        value: user?.babyBirthday ? dayjs(user.babyBirthday).format('YYYY-MM-DD') : '未设置',
      },
      { label: '宝宝性别', value: getBabyGenderLabel(user?.babyGender) },
    ],
    [maskedEmail, maskedPhone, user],
  )

  const openEditModal = useCallback(() => {
    const statusLabel = getPregnancyStatusLabel(user?.pregnancyStatus)
    const genderLabel = getBabyGenderLabel(user?.babyGender)
    setFormNickname(user?.nickname ?? '')
    setFormPregnancyStatus(statusLabel === '未设置' ? '备孕中' : statusLabel)
    setFormDueDate(user?.dueDate ? dayjs(user.dueDate).format('YYYY-MM-DD') : '')
    setFormBabyBirthday(user?.babyBirthday ? dayjs(user.babyBirthday).format('YYYY-MM-DD') : '')
    setFormBabyGender(genderLabel === '未设置' ? '未知' : genderLabel)
    setEditModalVisible(true)
  }, [user])

  const handleSaveProfile = useCallback(async () => {
    try {
      const payload: {
        nickname?: string
        pregnancyStatus?: number
        dueDate?: string
        babyBirthday?: string
        babyGender?: number
      } = {
        nickname: formNickname.trim(),
        pregnancyStatus: PREGNANCY_STATUS_TO_CODE[formPregnancyStatus],
        babyGender: BABY_GENDER_TO_CODE[formBabyGender],
      }

      if (formDueDate) payload.dueDate = formDueDate
      if (formBabyBirthday) payload.babyBirthday = formBabyBirthday

      const res = await authApi.updateProfile(payload)
      setUser(res ?? { ...user, ...payload })
      setEditModalVisible(false)
      setSnackMessage('资料更新成功')
    } catch (_error) {
      setSnackMessage('更新失败，请稍后重试')
    }
  }, [formBabyBirthday, formBabyGender, formDueDate, formNickname, formPregnancyStatus, setUser, user])

  const handleLogout = useCallback(() => {
    Alert.alert('确认退出', '确定要退出登录吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: async () => {
          try {
            await authApi.logout()
          } catch (_error) {
            // 退出不依赖服务端成功
          }
          resetChatState()
          resetMembershipState()
          await sessionStorage.clear()
          setUser(null)
          setToken(null)
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            }),
          )
        },
      },
    ])
  }, [navigation, resetChatState, resetMembershipState, setToken, setUser])

  const usageLabel = status === 'active' ? `${aiUsedToday}` : `${aiUsedToday}/${aiLimit}`
  const memberLabel =
    status === 'active' && expireAt ? `${activePlan?.name || '贝护会员'}` : '免费用户'

  return {
    user,
    initialLoading: !hydrated,
    stage,
    status,
    weeklyReports,
    checkInStreak,
    weeklyCompletionRate,
    accountRows,
    usageLabel,
    memberLabel,
    editModalVisible,
    formNickname,
    formPregnancyStatus,
    formDueDate,
    formBabyBirthday,
    formBabyGender,
    snackMessage,
    setSnackMessage,
    setFormNickname,
    setFormPregnancyStatus,
    setFormDueDate,
    setFormBabyBirthday,
    setFormBabyGender,
    openEditModal,
    setEditModalVisible,
    handleSaveProfile,
    handleLogout,
  }
}
