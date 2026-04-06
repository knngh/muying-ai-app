import React, { useCallback, useMemo, useState } from 'react'
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import {
  Avatar,
  Button,
  Card,
  Chip,
  Divider,
  Modal,
  Portal,
  Text,
  TextInput,
} from 'react-native-paper'
import { CommonActions, useFocusEffect, useNavigation } from '@react-navigation/native'
import dayjs from 'dayjs'
import { authApi } from '../api/modules'
import { useAppStore } from '../stores/appStore'
import { useChatStore } from '../stores/chatStore'
import { useMembershipStore } from '../stores/membershipStore'
import type { MembershipPlan, WeeklyReport } from '../stores/membershipStore'
import { colors, fontSize, spacing } from '../theme'
import { getStageSummary } from '../utils/stage'
import { sessionStorage } from '../utils/storage'

const PREGNANCY_STATUSES = ['备孕中', '孕期中', '产后']
const GENDER_OPTIONS = ['男', '女', '未知']

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

export default function ProfileScreen() {
  const navigation = useNavigation<any>()
  const { user, setToken, setUser } = useAppStore()
  const resetChatState = useChatStore(state => state.resetState)
  const resetMembershipState = useMembershipStore(state => state.resetState)
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
    ensureFreshQuota,
  } = useMembershipStore()

  const [editModalVisible, setEditModalVisible] = useState(false)
  const [formNickname, setFormNickname] = useState('')
  const [formPregnancyStatus, setFormPregnancyStatus] = useState('备孕中')
  const [formDueDate, setFormDueDate] = useState('')
  const [formBabyBirthday, setFormBabyBirthday] = useState('')
  const [formBabyGender, setFormBabyGender] = useState('未知')

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
    if (!name || !domain) {
      return email || '未设置'
    }

    if (name.length <= 2) {
      return `${name[0] || '*'}***@${domain}`
    }

    return `${name.slice(0, 2)}***@${domain}`
  }, [user?.email])

  const accountRows = useMemo(
    () => [
      { label: '用户名', value: user?.username ?? '未设置' },
      { label: '手机号', value: maskedPhone },
      { label: '邮箱', value: maskedEmail },
      { label: '孕育状态', value: getPregnancyStatusLabel(user?.pregnancyStatus) },
      { label: '预产期', value: user?.dueDate ? dayjs(user.dueDate).format('YYYY-MM-DD') : '未设置' },
      { label: '宝宝生日', value: user?.babyBirthday ? dayjs(user.babyBirthday).format('YYYY-MM-DD') : '未设置' },
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
      Alert.alert('提示', '资料更新成功')
    } catch (_error) {
      Alert.alert('错误', '更新失败，请稍后重试')
    }
  }, [
    formBabyBirthday,
    formBabyGender,
    formDueDate,
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.heroCard}>
          <Card.Content>
            <View style={styles.heroHeader}>
              <Avatar.Icon size={72} icon="account" style={styles.avatar} />
              <View style={styles.heroMeta}>
                <Text style={styles.nickname}>{user?.nickname || user?.username || '未设置昵称'}</Text>
                <Text style={styles.stageText}>{stage.title}</Text>
                <Text style={styles.memberText}>
                  {status === 'active' && expireAt
                    ? `${activePlan?.name || '贝护会员'} · 至 ${dayjs(expireAt).format('YYYY-MM-DD')}`
                    : '免费用户 · 可升级解锁完整权益'}
                </Text>
              </View>
            </View>

            <View style={styles.heroActions}>
              <Button mode="contained" buttonColor={colors.white} textColor={colors.ink} onPress={() => navigation.navigate('Membership')}>
                {status === 'active' ? '管理会员' : '立即升级'}
              </Button>
              <Button mode="outlined" textColor={colors.white} onPress={openEditModal}>
                编辑资料
              </Button>
            </View>
          </Card.Content>
        </Card>

        <View style={styles.statRow}>
          <Card style={styles.statCard}>
            <Card.Content>
              <Text style={styles.statLabel}>AI 使用</Text>
              <Text style={styles.statValue}>
                {status === 'active' ? `${aiUsedToday} 次` : `${aiUsedToday} / ${aiLimit} 次`}
              </Text>
            </Card.Content>
          </Card>
          <Card style={styles.statCard}>
            <Card.Content>
              <Text style={styles.statLabel}>连续打卡</Text>
              <Text style={styles.statValue}>{checkInStreak} 天</Text>
            </Card.Content>
          </Card>
          <Card style={styles.statCard}>
            <Card.Content>
              <Text style={styles.statLabel}>周完成率</Text>
              <Text style={styles.statValue}>{weeklyCompletionRate}%</Text>
            </Card.Content>
          </Card>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>AI 周报</Text>
            <Text style={styles.sectionMeta}>{status === 'active' ? '历史可查看' : '会员专属能力'}</Text>
          </View>

          <Button mode="text" onPress={() => navigation.navigate(status === 'active' ? 'WeeklyReport' : 'Membership')}>
            {status === 'active' ? '查看全部周报' : '升级后查看完整历史'}
          </Button>

          {weeklyReports.map((report: WeeklyReport) => (
            <Card key={report.id} style={styles.reportCard}>
              <Card.Content>
                <Text style={styles.reportTitle}>{report.title}</Text>
                <Text style={styles.reportMeta}>
                  {report.stageLabel} · {dayjs(report.createdAt).format('MM-DD')}
                </Text>
                {report.highlights.map((item: string, index: number) => (
                  <Text key={item} style={styles.reportItem}>
                    {index + 1}. {status === 'active' || index === 0 ? item : '升级后查看完整建议'}
                  </Text>
                ))}
              </Card.Content>
            </Card>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>账户资料</Text>
            <Text style={styles.sectionMeta}>当前阶段：{stage.title}</Text>
          </View>

          <Card style={styles.infoCard}>
            <Card.Content>
              {accountRows.map((row: { label: string; value: string }, index: number) => (
                <View key={row.label}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{row.label}</Text>
                    <Text style={styles.infoValue}>{row.value}</Text>
                  </View>
                  {index < accountRows.length - 1 ? <Divider /> : null}
                </View>
              ))}
            </Card.Content>
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>会员权益速览</Text>
          <View style={styles.benefitWrap}>
            {['AI 无限次', '个性化周报', '阶段圈子', '成长档案导出'].map((item) => (
              <Chip key={item} style={styles.benefitChip} textStyle={styles.benefitChipText}>
                {item}
              </Chip>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>成长档案</Text>
            <Text style={styles.sectionMeta}>{status === 'active' ? '会员增强能力' : '预览版'}</Text>
          </View>

          <Card style={styles.archiveCard}>
            <Card.Content>
              <Text style={styles.archiveTitle}>把阶段、周报和打卡数据整理成一份可回看的成长档案。</Text>
              <Text style={styles.archiveSubtitle}>
                {status === 'active'
                  ? '现在可以查看阶段时间轴，并导出一份可分享的档案摘要。'
                  : '升级后可查看完整档案、阶段时间轴和分享摘要。'}
              </Text>
              <Button
                mode="contained"
                buttonColor={colors.ink}
                onPress={() => navigation.navigate('GrowthArchive')}
                style={styles.archiveButton}
              >
                {status === 'active' ? '查看成长档案' : '查看档案预览'}
              </Button>
            </Card.Content>
          </Card>
        </View>

        <Button mode="outlined" icon="logout" onPress={handleLogout} style={styles.logoutButton} textColor={colors.red}>
          退出登录
        </Button>
      </ScrollView>

      <Portal>
        <Modal
          visible={editModalVisible}
          onDismiss={() => setEditModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <ScrollView>
            <Text style={styles.modalTitle}>编辑资料</Text>

            <TextInput
              label="昵称"
              value={formNickname}
              onChangeText={setFormNickname}
              mode="outlined"
              style={styles.input}
              activeOutlineColor={colors.primary}
            />

            <Text style={styles.fieldLabel}>孕育状态</Text>
            <View style={styles.optionRow}>
              {PREGNANCY_STATUSES.map((statusLabel) => (
                <TouchableOpacity
                  key={statusLabel}
                  onPress={() => setFormPregnancyStatus(statusLabel)}
                  style={[
                    styles.optionButton,
                    formPregnancyStatus === statusLabel && styles.optionButtonSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      formPregnancyStatus === statusLabel && styles.optionTextSelected,
                    ]}
                  >
                    {statusLabel}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              label="预产期 (YYYY-MM-DD)"
              value={formDueDate}
              onChangeText={setFormDueDate}
              mode="outlined"
              style={styles.input}
              activeOutlineColor={colors.primary}
            />

            <TextInput
              label="宝宝生日 (YYYY-MM-DD)"
              value={formBabyBirthday}
              onChangeText={setFormBabyBirthday}
              mode="outlined"
              style={styles.input}
              activeOutlineColor={colors.primary}
            />

            <Text style={styles.fieldLabel}>宝宝性别</Text>
            <View style={styles.optionRow}>
              {GENDER_OPTIONS.map((gender) => (
                <TouchableOpacity
                  key={gender}
                  onPress={() => setFormBabyGender(gender)}
                  style={[
                    styles.optionButton,
                    formBabyGender === gender && styles.optionButtonSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      formBabyGender === gender && styles.optionTextSelected,
                    ]}
                  >
                    {gender}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Button mode="text" onPress={() => setEditModalVisible(false)}>
                取消
              </Button>
              <Button mode="contained" buttonColor={colors.ink} onPress={handleSaveProfile}>
                保存
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  heroCard: {
    borderRadius: 26,
    backgroundColor: colors.ink,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    backgroundColor: colors.gold,
  },
  heroMeta: {
    flex: 1,
    gap: spacing.xs,
  },
  nickname: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '700',
  },
  stageText: {
    color: '#dfe7ff',
  },
  memberText: {
    color: '#bac7e9',
    lineHeight: 20,
  },
  heroActions: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: colors.white,
  },
  statLabel: {
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionHeader: {
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
  },
  sectionMeta: {
    color: colors.textSecondary,
  },
  reportCard: {
    marginBottom: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.white,
  },
  reportTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  reportMeta: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    color: colors.textLight,
  },
  reportItem: {
    marginBottom: spacing.sm,
    color: colors.text,
    lineHeight: 22,
  },
  infoCard: {
    borderRadius: 20,
    backgroundColor: colors.white,
  },
  infoRow: {
    paddingVertical: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  infoLabel: {
    color: colors.textSecondary,
  },
  infoValue: {
    flexShrink: 1,
    textAlign: 'right',
    color: colors.text,
    fontWeight: '600',
  },
  benefitWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  benefitChip: {
    backgroundColor: colors.goldLight,
  },
  benefitChipText: {
    color: colors.gold,
    fontWeight: '700',
  },
  archiveCard: {
    borderRadius: 20,
    backgroundColor: colors.white,
  },
  archiveTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 24,
  },
  archiveSubtitle: {
    marginTop: spacing.sm,
    color: colors.textLight,
    lineHeight: 22,
  },
  archiveButton: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
  },
  logoutButton: {
    marginTop: spacing.xl,
    borderColor: colors.red,
  },
  modalContainer: {
    margin: spacing.md,
    maxHeight: '84%',
    borderRadius: 24,
    padding: spacing.lg,
    backgroundColor: colors.white,
  },
  modalTitle: {
    marginBottom: spacing.lg,
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text,
  },
  input: {
    marginBottom: spacing.md,
    backgroundColor: colors.white,
  },
  fieldLabel: {
    marginBottom: spacing.sm,
    color: colors.textSecondary,
  },
  optionRow: {
    marginBottom: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  optionButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  optionButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  optionText: {
    color: colors.text,
  },
  optionTextSelected: {
    color: colors.white,
  },
  modalActions: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
})
