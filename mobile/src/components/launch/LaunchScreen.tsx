import React from 'react'
import { StyleSheet, View } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { ActivityIndicator, Chip, Text } from 'react-native-paper'
import { borderRadius, colors, fontSize, spacing } from '../../theme'

export type LaunchStep = {
  label: string
  status: 'pending' | 'active' | 'done'
}

type LaunchSpotlight = {
  eyebrow: string
  title: string
  caption: string
}

type LaunchScreenProps = {
  variant?: 'boot' | 'welcome'
  compact?: boolean
  chipLabel?: string
  title?: string
  subtitle?: string
  statusTitle?: string
  statusText?: string
  progress?: number
  spotlight?: LaunchSpotlight
  journey?: string[]
  steps?: LaunchStep[]
}

const variantCopy: Record<NonNullable<LaunchScreenProps['variant']>, {
  chip: string
  title: string
  subtitle: string
  caption: string
  spotlight: LaunchSpotlight
  journey: string[]
  steps: LaunchStep[]
}> = {
  boot: {
    chip: '移动端唤起中',
    title: '正在恢复连续陪伴链路',
    subtitle: '会先恢复当前阶段，再同步阅读问答、周报与成长档案入口。',
    caption: '正在恢复你的陪伴节奏',
    spotlight: {
      eyebrow: '恢复内容',
      title: '阶段知识、成长日历、周报与档案',
      caption: '不是通用母婴信息流，而是围绕当前阶段恢复你的连续使用上下文。',
    },
    journey: ['阶段知识', '成长日历', '周报回顾', '成长档案'],
    steps: [
      { label: '识别本机会话', status: 'active' },
      { label: '恢复当前阶段', status: 'pending' },
      { label: '同步配额与周报', status: 'pending' },
      { label: '进入首页', status: 'pending' },
    ],
  },
  welcome: {
    chip: '移动端陪伴中枢',
    title: '打开后直接接上当前阶段',
    subtitle: '登录后不是进入一个通用首页，而是回到你的阶段知识、今天安排、周报和成长档案。',
    caption: '准备进入连续陪伴模式',
    spotlight: {
      eyebrow: '服务链路',
      title: '知识库 -> 日历 -> 周报 -> 档案',
      caption: '这是贝护妈妈移动端的核心链路，目标是让每次打开都能顺着上次继续。',
    },
    journey: ['备孕', '孕期', '产后恢复', '育儿阶段'],
    steps: [
      { label: '登录账号', status: 'done' },
      { label: '恢复当前阶段', status: 'active' },
      { label: '进入连续陪伴首页', status: 'pending' },
    ],
  },
}

const journeyIconMap = {
  '阶段知识': 'book-open-page-variant-outline',
  '成长日历': 'calendar-heart',
  '周报回顾': 'file-chart-outline',
  '成长档案': 'timeline-text-outline',
  '备孕': 'sprout',
  '孕期': 'baby-bottle-outline',
  '产后恢复': 'heart-pulse',
  '育儿阶段': 'human-male-female-child',
} as const

function getStepColors(status: LaunchStep['status']) {
  if (status === 'done') {
    return {
      dot: colors.primaryDark,
      text: colors.ink,
      line: 'rgba(197,108,71,0.26)',
    }
  }

  if (status === 'active') {
    return {
      dot: colors.techDark,
      text: colors.techDark,
      line: 'rgba(53,88,98,0.22)',
    }
  }

  return {
    dot: 'rgba(94,126,134,0.26)',
    text: colors.textSecondary,
    line: 'rgba(94,126,134,0.12)',
  }
}

export default function LaunchScreen({
  variant = 'boot',
  compact = false,
  chipLabel,
  title,
  subtitle,
  statusTitle,
  statusText,
  progress,
  spotlight,
  journey,
  steps,
}: LaunchScreenProps) {
  const copy = variantCopy[variant]
  const resolvedProgress = typeof progress === 'number' ? Math.min(Math.max(progress, 0), 1) : 0.68
  const resolvedSpotlight = spotlight || copy.spotlight
  const resolvedJourney = journey || copy.journey
  const resolvedSteps = steps || copy.steps
  const statusBarFillWidth = `${Math.round(resolvedProgress * 100)}%` as `${number}%`
  const statusBarFillStyle = [styles.statusBarFill, { width: statusBarFillWidth }]

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FFF7F0', '#F5E6D8', '#E8F0F1']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      />
      <View style={styles.orbTop} />
      <View style={styles.orbBottom} />
      <View style={styles.grid} />

      <View style={styles.content}>
        <Chip compact style={styles.chip} textStyle={styles.chipText}>
          {chipLabel || copy.chip}
        </Chip>

        <Text style={[styles.title, compact && styles.titleCompact]}>{title || copy.title}</Text>
        <Text style={[styles.subtitle, compact && styles.subtitleCompact]}>{subtitle || copy.subtitle}</Text>

        <View style={[styles.spotlightCard, compact && styles.spotlightCardCompact]}>
          <Text style={styles.spotlightEyebrow}>{resolvedSpotlight.eyebrow}</Text>
          <Text style={styles.spotlightTitle}>{resolvedSpotlight.title}</Text>
          <Text style={styles.spotlightCaption}>{resolvedSpotlight.caption}</Text>
        </View>

        <View style={styles.pillarRow}>
          {resolvedJourney.map((item) => {
            const iconName = journeyIconMap[item as keyof typeof journeyIconMap] || 'orbit'

            return (
              <View key={item} style={styles.pillarCard}>
                <View style={styles.pillarIconWrap}>
                  <MaterialCommunityIcons name={iconName} size={18} color={colors.techDark} />
                </View>
                <Text style={styles.pillarLabel}>{item}</Text>
              </View>
            )
          })}
        </View>

        <LinearGradient
          colors={['rgba(255,252,248,0.94)', 'rgba(248,239,231,0.94)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.statusCard}
        >
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>{statusTitle || copy.caption}</Text>
            <ActivityIndicator size="small" color={colors.primaryDark} />
          </View>
          <Text style={styles.statusText}>
            {statusText || '启动后会直接回到你的上次状态，不需要再从空页面重新找入口。'}
          </Text>
          <View style={styles.statusBarTrack}>
            <View style={statusBarFillStyle} />
          </View>
          <View style={[styles.stepsWrap, compact && styles.stepsWrapCompact]}>
            {resolvedSteps.map((step) => {
              const colorSet = getStepColors(step.status)
              const stepDotStyle = [styles.stepDot, { backgroundColor: colorSet.dot, borderColor: colorSet.line }]
              const stepLabelStyle = [styles.stepLabel, { color: colorSet.text }]
              return (
                <View key={step.label} style={styles.stepRow}>
                  <View style={stepDotStyle} />
                  <Text style={stepLabelStyle}>{step.label}</Text>
                </View>
              )
            })}
          </View>
        </LinearGradient>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSoft,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  orbTop: {
    position: 'absolute',
    top: -80,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(244, 216, 199, 0.72)',
  },
  orbBottom: {
    position: 'absolute',
    bottom: -90,
    left: -50,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(211, 229, 233, 0.52)',
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.22,
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.08)',
    transform: [{ scale: 1.18 }, { rotate: '-4deg' }],
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  chip: {
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
    backgroundColor: 'rgba(255,253,249,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.12)',
  },
  chipText: {
    color: colors.techDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    color: colors.inkDeep,
    letterSpacing: 0.4,
  },
  titleCompact: {
    fontSize: 28,
    lineHeight: 34,
  },
  subtitle: {
    marginTop: spacing.sm,
    color: colors.inkSoft,
    fontSize: fontSize.lg,
    lineHeight: 26,
    maxWidth: 320,
  },
  subtitleCompact: {
    fontSize: fontSize.md,
    lineHeight: 22,
    maxWidth: undefined,
  },
  spotlightCard: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,252,248,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.12)',
  },
  spotlightCardCompact: {
    marginTop: spacing.md,
  },
  spotlightEyebrow: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.techDark,
    marginBottom: spacing.xs,
  },
  spotlightTitle: {
    fontSize: fontSize.lg,
    lineHeight: 24,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  spotlightCaption: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  pillarRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  pillarCard: {
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: 88,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(255,252,248,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.1)',
    shadowColor: colors.shadowStrong,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 0,
  },
  pillarIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.techLight,
    marginBottom: spacing.sm,
  },
  pillarLabel: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    lineHeight: 18,
    color: colors.text,
  },
  statusCard: {
    marginTop: spacing.xl,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.14)',
    overflow: 'hidden',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  statusTitle: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: colors.ink,
  },
  statusText: {
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  statusBarTrack: {
    marginTop: spacing.md,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(94,126,134,0.12)',
    overflow: 'hidden',
  },
  statusBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  stepsWrap: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  stepsWrapCompact: {
    marginTop: spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  stepLabel: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
})
