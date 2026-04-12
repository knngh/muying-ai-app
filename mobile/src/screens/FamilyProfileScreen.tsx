import React, { useMemo } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Button, Chip, Text } from 'react-native-paper'
import { useNavigation } from '@react-navigation/native'
import dayjs from 'dayjs'
import LinearGradient from 'react-native-linear-gradient'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { ScreenContainer, StandardCard } from '../components/layout'
import { useAppStore } from '../stores/appStore'
import { useMembershipStore } from '../stores/membershipStore'
import { getStageSummary } from '../utils/stage'
import { colors, fontSize, spacing, borderRadius } from '../theme'

type ArchiveRow = {
  label: string
  value: string
}

type TimelineRow = {
  label: string
  value: string
  detail: string
}

function formatDate(value?: string | null): string {
  return value ? dayjs(value).format('YYYY-MM-DD') : '未设置'
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

function getChildAgeLabel(
  babyBirthday?: string | null,
  dueDate?: string | null,
): string {
  if (!babyBirthday) {
    return dueDate ? '待出生' : '未设置'
  }

  const birth = dayjs(babyBirthday)
  const now = dayjs()
  const totalMonths = Math.max(now.diff(birth, 'month'), 0)

  if (totalMonths < 24) {
    const anchor = birth.add(totalMonths, 'month')
    return `${totalMonths} 月 ${Math.max(now.diff(anchor, 'day'), 0)} 天`
  }

  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  return `${years} 岁 ${months} 月`
}

export default function FamilyProfileScreen() {
  const navigation = useNavigation<any>()
  const user = useAppStore((state) => state.user)
  const { status, currentPlanCode, plans } = useMembershipStore()
  const stage = useMemo(() => getStageSummary(user), [user])

  const activePlan = plans.find((item) => item.code === currentPlanCode)
  const memberStatusLabel = status === 'active' ? activePlan?.name || '已开通会员' : '免费用户'

  const caregiverRows = useMemo<ArchiveRow[]>(() => ([
    { label: '照护者昵称', value: user?.nickname || user?.username || '未设置' },
    { label: '照护者角色', value: getCaregiverRoleLabel(user?.caregiverRole) },
    { label: '当前家庭阶段', value: stage.lifecycleLabel },
    { label: '账户状态', value: stage.profileStatusLabel },
    { label: '会员状态', value: memberStatusLabel },
  ]), [
    activePlan?.name,
    memberStatusLabel,
    stage.lifecycleLabel,
    stage.profileStatusLabel,
    user?.caregiverRole,
    user?.nickname,
    user?.username,
  ])

  const childRows = useMemo<ArchiveRow[]>(() => ([
    { label: '孩子昵称', value: user?.childNickname || '未设置' },
    { label: '预产期', value: formatDate(user?.dueDate) },
    { label: '宝宝生日', value: formatDate(user?.babyBirthday) },
    { label: '当前年龄', value: getChildAgeLabel(user?.babyBirthday, user?.dueDate) },
    { label: '宝宝性别', value: user?.babyGender === 1 ? '男' : user?.babyGender === 2 ? '女' : '未知' },
    { label: '分娩方式', value: getChildBirthModeLabel(user?.childBirthMode) },
    { label: '喂养方式', value: getFeedingModeLabel(user?.feedingMode) },
  ]), [user?.babyBirthday, user?.babyGender, user?.childBirthMode, user?.childNickname, user?.dueDate, user?.feedingMode])

  const familyRows = useMemo<ArchiveRow[]>(() => ([
    { label: '发育关注点', value: user?.developmentConcerns || '未设置' },
    { label: '家庭备注', value: user?.familyNotes || '未设置' },
  ]), [user?.developmentConcerns, user?.familyNotes])

  const dashboardCards = useMemo<ArchiveRow[]>(() => ([
    { label: '当前阶段', value: stage.lifecycleLabel },
    { label: '宝宝年龄', value: getChildAgeLabel(user?.babyBirthday, user?.dueDate) },
    { label: '会员状态', value: memberStatusLabel },
  ]), [memberStatusLabel, stage.lifecycleLabel, user?.babyBirthday, user?.dueDate])

  const timeline = useMemo<TimelineRow[]>(() => {
    const items: TimelineRow[] = []

    if (user?.createdAt) {
      items.push({
        label: '加入贝护妈妈',
        value: dayjs(user.createdAt).format('YYYY-MM-DD'),
        detail: '账户开始累积生命周期记录。',
      })
    }

    if (user?.dueDate) {
      items.push({
        label: '预产期',
        value: dayjs(user.dueDate).format('YYYY-MM-DD'),
        detail: '孕期阶段会由预产期自动切到孕早、中、晚期。',
      })
    }

    if (user?.babyBirthday) {
      items.push({
        label: '宝宝生日',
        value: dayjs(user.babyBirthday).format('YYYY-MM-DD'),
        detail: '育儿阶段会由宝宝生日自动切到更细年龄段。',
      })
    }

    return items
  }, [user?.babyBirthday, user?.createdAt, user?.dueDate])

  const renderGridRows = (rows: ArchiveRow[]) => (
    <View style={styles.gridRows}>
      {rows.map((row) => (
        <View key={row.label} style={styles.infoGridCard}>
          <Text style={styles.infoGridLabel}>{row.label}</Text>
          <Text style={styles.infoGridValue}>{row.value}</Text>
        </View>
      ))}
    </View>
  )

  const renderLongRows = (rows: ArchiveRow[]) => (
    <StandardCard>
      {rows.map((row, index) => (
        <View key={row.label} style={[styles.row, index < rows.length - 1 && styles.rowBorder]}>
          <View style={styles.rowLabelWrap}>
            <Text style={styles.rowLabel}>{row.label}</Text>
          </View>
          <Text style={styles.rowValue}>{row.value}</Text>
        </View>
      ))}
    </StandardCard>
  )

  return (
    <ScreenContainer style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <StandardCard style={styles.heroCard} elevation={2}>
          <LinearGradient
            colors={['#FAE6D8', '#F3D7C6', '#FBF3EB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.heroOrbit} />
            <View style={styles.heroTop}>
              <Chip style={styles.heroChip} textStyle={styles.heroChipText}>
                家庭档案
              </Chip>
              <Text style={styles.heroTitle}>{stage.title}</Text>
              <Text style={styles.heroSubtitle}>把照护者、孩子与阶段重点沉淀成一份长期家庭主档案。</Text>
            </View>

            <View style={styles.heroTagRow}>
              {stage.statusTags.slice(0, 4).map((tag) => (
                <Chip key={tag} compact style={styles.statusChip} textStyle={styles.statusChipText}>
                  {tag}
                </Chip>
              ))}
            </View>
          </LinearGradient>
        </StandardCard>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>家庭概览</Text>
          {renderGridRows(dashboardCards)}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>照护者信息</Text>
          {renderGridRows(caregiverRows)}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>孩子档案</Text>
          {renderGridRows(childRows)}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>当前阶段重点</Text>
          <StandardCard style={styles.focusCard}>
            <View style={styles.focusHeader}>
              <View style={styles.focusIconShell}>
                <MaterialCommunityIcons name="radar" size={18} color={colors.techDark} />
              </View>
              <Text style={styles.focusHeaderText}>阶段雷达</Text>
            </View>
            <Text style={styles.focusTitle}>{stage.focusTitle}</Text>
            <Text style={styles.focusText}>{stage.reminder}</Text>
            <Text style={styles.focusLabel}>本阶段适合重点追踪</Text>
            <View style={styles.focusTagRow}>
              {stage.knowledgeKeywords.slice(0, 4).map((keyword) => (
                <Chip key={keyword} compact style={styles.focusChip} textStyle={styles.focusChipText}>
                  {keyword}
                </Chip>
              ))}
            </View>
          </StandardCard>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>照护关注</Text>
          {renderLongRows(familyRows)}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>生命周期时间轴</Text>
          {timeline.map((item, index) => (
            <View key={`${item.label}-${item.value}`} style={styles.timelineRow}>
              <View style={styles.timelineRail}>
                <View style={styles.timelineDot} />
                {index < timeline.length - 1 ? <View style={styles.timelineLine} /> : null}
              </View>
              <StandardCard style={styles.timelineCard}>
                <Text style={styles.timelineLabel}>{item.label}</Text>
                <Text style={styles.timelineValue}>{item.value}</Text>
                <Text style={styles.timelineDetail}>{item.detail}</Text>
              </StandardCard>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <StandardCard style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>档案说明</Text>
            <Text style={styles.noticeText}>
              这页已经接入当前账户里的家庭档案字段，App 会结合预产期、宝宝生日和照护信息自动切换全生命周期阶段。后续如果要支持多孩、分角色协作和长期成长记录，再往真正的家庭档案系统继续扩展。
            </Text>
            <Button mode="contained" buttonColor={colors.ink} onPress={() => navigation.navigate('Main', { screen: 'Profile', params: { autoOpenEdit: true } })} style={styles.noticeButton}>
              返回我的页继续管理
            </Button>
          </StandardCard>
        </View>
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  heroCard: {
    borderRadius: borderRadius.xl,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  heroGradient: {
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  heroOrbit: {
    position: 'absolute',
    right: -28,
    top: -20,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(94,126,134,0.08)',
  },
  heroTop: {
    gap: spacing.sm,
  },
  heroChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 253, 249, 0.92)',
  },
  heroChipText: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  heroTitle: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.ink,
  },
  heroSubtitle: {
    color: colors.inkSoft,
    lineHeight: 22,
  },
  heroTagRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statusChip: {
    backgroundColor: 'rgba(255, 253, 249, 0.82)',
  },
  statusChipText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  gridRows: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  infoGridCard: {
    width: '48%',
    minHeight: 104,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    backgroundColor: 'rgba(255,249,244,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.12)',
  },
  infoGridLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginBottom: spacing.sm,
  },
  infoGridValue: {
    color: colors.inkDeep,
    fontSize: fontSize.md,
    fontWeight: '700',
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
  },
  rowLabelWrap: {
    width: 84,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  rowValue: {
    flex: 1,
    textAlign: 'left',
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  focusCard: {
    padding: spacing.md,
  },
  focusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  focusIconShell: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(94,126,134,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusHeaderText: {
    color: colors.techDark,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  focusTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  focusText: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  focusLabel: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  focusTagRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  focusChip: {
    backgroundColor: colors.accentLight,
  },
  focusChipText: {
    color: colors.inkSoft,
    fontWeight: '600',
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  timelineRail: {
    width: 22,
    alignItems: 'center',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.primaryDark,
    marginTop: 20,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border,
    marginTop: 4,
  },
  timelineCard: {
    flex: 1,
    padding: spacing.md,
  },
  timelineLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  timelineValue: {
    marginTop: spacing.xs,
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  timelineDetail: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  noticeCard: {
    padding: spacing.md,
  },
  noticeTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  noticeText: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  noticeButton: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    borderRadius: borderRadius.pill,
  },
})
