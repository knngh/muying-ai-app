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
  育儿中: 3,
}

const CAREGIVER_ROLE_TO_CODE: Record<string, number> = {
  妈妈: 1,
  爸爸: 2,
  祖辈: 3,
  其他: 4,
  未知: 0,
}

const CHILDBIRTH_MODE_TO_CODE: Record<string, number> = {
  顺产: 1,
  剖宫产: 2,
  未知: 0,
}

const FEEDING_MODE_TO_CODE: Record<string, number> = {
  母乳: 1,
  配方奶: 2,
  混合喂养: 3,
  辅食为主: 4,
  未知: 0,
}

const BABY_GENDER_TO_CODE: Record<string, number> = {
  男: 1,
  女: 2,
  未知: 0,
}

function getPregnancyStatusLabel(
  value?: string | number | null,
  dueDate?: string | null,
  babyBirthday?: string | null,
): string {
  if (dueDate || value === 2 || value === '2' || value === 'pregnant') return '孕期中'
  if (babyBirthday || value === 3 || value === '3' || value === 'postpartum') return '育儿中'
  if (value === 1 || value === '1' || value === 'preparing') return '备孕中'
  return '未设置'
}

function getBabyGenderLabel(value?: string | number | null): string {
  if (value === 1 || value === '1' || value === 'male') return '男'
  if (value === 2 || value === '2' || value === 'female') return '女'
  if (value === 0 || value === '0' || value === 'unknown') return '未知'
  return '未设置'
}

function getCaregiverRoleLabel(value?: string | number | null): string {
  if (value === 1 || value === '1' || value === 'mother') return '妈妈'
  if (value === 2 || value === '2' || value === 'father') return '爸爸'
  if (value === 3 || value === '3' || value === 'grandparent') return '祖辈'
  if (value === 4 || value === '4' || value === 'other') return '其他'
  if (value === 0 || value === '0') return '未知'
  return '未设置'
}

function getChildBirthModeLabel(value?: string | number | null): string {
  if (value === 1 || value === '1' || value === 'vaginal') return '顺产'
  if (value === 2 || value === '2' || value === 'csection') return '剖宫产'
  if (value === 0 || value === '0') return '未知'
  return '未设置'
}

function getFeedingModeLabel(value?: string | number | null): string {
  if (value === 1 || value === '1' || value === 'breastfeeding') return '母乳'
  if (value === 2 || value === '2' || value === 'formula') return '配方奶'
  if (value === 3 || value === '3' || value === 'mixed') return '混合喂养'
  if (value === 4 || value === '4' || value === 'solids') return '辅食为主'
  if (value === 0 || value === '0') return '未知'
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
  const [formCaregiverRole, setFormCaregiverRole] = useState('未知')
  const [formChildNickname, setFormChildNickname] = useState('')
  const [formChildBirthMode, setFormChildBirthMode] = useState('未知')
  const [formFeedingMode, setFormFeedingMode] = useState('未知')
  const [formDevelopmentConcerns, setFormDevelopmentConcerns] = useState('')
  const [formFamilyNotes, setFormFamilyNotes] = useState('')
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
      { label: '当前阶段', value: stage.lifecycleLabel },
      { label: '账户状态', value: getPregnancyStatusLabel(user?.pregnancyStatus, user?.dueDate, user?.babyBirthday) },
      {
        label: user?.dueDate ? '预产期' : (user?.babyBirthday ? '宝宝生日' : '关键日期'),
        value: user?.dueDate
          ? dayjs(user.dueDate).format('YYYY-MM-DD')
          : (user?.babyBirthday ? dayjs(user.babyBirthday).format('YYYY-MM-DD') : '未设置'),
      },
      { label: '孩子昵称', value: user?.childNickname || '未设置' },
      { label: '照护者角色', value: getCaregiverRoleLabel(user?.caregiverRole) },
    ],
    [maskedEmail, maskedPhone, stage.lifecycleLabel, user],
  )

  const openEditModal = useCallback(() => {
    const statusLabel = getPregnancyStatusLabel(user?.pregnancyStatus, user?.dueDate, user?.babyBirthday)
    const genderLabel = getBabyGenderLabel(user?.babyGender)
    const caregiverRoleLabel = getCaregiverRoleLabel(user?.caregiverRole)
    const childBirthModeLabel = getChildBirthModeLabel(user?.childBirthMode)
    const feedingModeLabel = getFeedingModeLabel(user?.feedingMode)
    setFormNickname(user?.nickname ?? '')
    setFormPregnancyStatus(statusLabel === '未设置' ? '备孕中' : statusLabel)
    setFormDueDate(user?.dueDate ? dayjs(user.dueDate).format('YYYY-MM-DD') : '')
    setFormBabyBirthday(user?.babyBirthday ? dayjs(user.babyBirthday).format('YYYY-MM-DD') : '')
    setFormBabyGender(genderLabel === '未设置' ? '未知' : genderLabel)
    setFormCaregiverRole(caregiverRoleLabel === '未设置' ? '未知' : caregiverRoleLabel)
    setFormChildNickname(user?.childNickname ?? '')
    setFormChildBirthMode(childBirthModeLabel === '未设置' ? '未知' : childBirthModeLabel)
    setFormFeedingMode(feedingModeLabel === '未设置' ? '未知' : feedingModeLabel)
    setFormDevelopmentConcerns(user?.developmentConcerns ?? '')
    setFormFamilyNotes(user?.familyNotes ?? '')
    setEditModalVisible(true)
  }, [user])

  const handleSaveProfile = useCallback(async () => {
    try {
      if (formPregnancyStatus === '孕期中' && !formDueDate.trim()) {
        setSnackMessage('请先选择预产期')
        return
      }

      if (formPregnancyStatus === '育儿中' && !formBabyBirthday.trim()) {
        setSnackMessage('请先选择宝宝生日')
        return
      }

      const payload: {
        nickname?: string
        pregnancyStatus?: number
        dueDate?: string | null
        babyBirthday?: string | null
        babyGender?: number
        caregiverRole?: number
        childNickname?: string | null
        childBirthMode?: number
        feedingMode?: number
        developmentConcerns?: string | null
        familyNotes?: string | null
      } = {
        nickname: formNickname.trim() || undefined,
        pregnancyStatus: PREGNANCY_STATUS_TO_CODE[formPregnancyStatus],
        babyGender: BABY_GENDER_TO_CODE[formBabyGender],
        caregiverRole: CAREGIVER_ROLE_TO_CODE[formCaregiverRole],
        childNickname: formChildNickname.trim() || null,
        childBirthMode: CHILDBIRTH_MODE_TO_CODE[formChildBirthMode],
        feedingMode: FEEDING_MODE_TO_CODE[formFeedingMode],
        developmentConcerns: formDevelopmentConcerns.trim() || null,
        familyNotes: formFamilyNotes.trim() || null,
      }

      if (formPregnancyStatus === '备孕中') {
        payload.dueDate = null
        payload.babyBirthday = null
      } else if (formPregnancyStatus === '孕期中') {
        payload.dueDate = formDueDate || null
        payload.babyBirthday = null
      } else {
        payload.dueDate = null
        payload.babyBirthday = formBabyBirthday || null
      }

      const res = await authApi.updateProfile(payload)
      setUser(res ?? { ...user, ...payload })
      setEditModalVisible(false)
      setSnackMessage('资料更新成功')
    } catch (_error) {
      setSnackMessage('更新失败，请稍后重试')
    }
  }, [
    formBabyBirthday,
    formBabyGender,
    formCaregiverRole,
    formChildBirthMode,
    formChildNickname,
    formDevelopmentConcerns,
    formDueDate,
    formFamilyNotes,
    formFeedingMode,
    formNickname,
    formPregnancyStatus,
    setUser,
    user,
  ])

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
    formCaregiverRole,
    formChildNickname,
    formChildBirthMode,
    formFeedingMode,
    formDevelopmentConcerns,
    formFamilyNotes,
    snackMessage,
    setSnackMessage,
    setFormNickname,
    setFormPregnancyStatus,
    setFormDueDate,
    setFormBabyBirthday,
    setFormBabyGender,
    setFormCaregiverRole,
    setFormChildNickname,
    setFormChildBirthMode,
    setFormFeedingMode,
    setFormDevelopmentConcerns,
    setFormFamilyNotes,
    openEditModal,
    setEditModalVisible,
    handleSaveProfile,
    handleLogout,
  }
}
