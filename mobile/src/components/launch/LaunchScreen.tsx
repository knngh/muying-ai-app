import React from 'react'
import { StyleSheet, View } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { ActivityIndicator, Chip, Text } from 'react-native-paper'
import { borderRadius, colors, fontSize, spacing } from '../../theme'

type LaunchScreenProps = {
  variant?: 'boot' | 'welcome'
}

const variantCopy: Record<NonNullable<LaunchScreenProps['variant']>, {
  chip: string
  title: string
  subtitle: string
  caption: string
}> = {
  boot: {
    chip: '移动端唤起中',
    title: '贝护妈妈',
    subtitle: '知识库、问题助手、成长日历与阶段提醒正在接入你的当前状态。',
    caption: '正在恢复你的陪伴节奏',
  },
  welcome: {
    chip: '移动端陪伴中枢',
    title: '今天先把节奏接上',
    subtitle: '登录后，首页、问答、知识库和成长档案会围绕当前阶段自动联动。',
    caption: '准备进入连续陪伴模式',
  },
}

const pillars = [
  { icon: 'book-open-page-variant-outline', label: '权威知识' },
  { icon: 'message-question-outline', label: '即时问答' },
  { icon: 'calendar-heart', label: '成长节奏' },
]

export default function LaunchScreen({ variant = 'boot' }: LaunchScreenProps) {
  const copy = variantCopy[variant]

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
          {copy.chip}
        </Chip>

        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.subtitle}>{copy.subtitle}</Text>

        <View style={styles.pillarRow}>
          {pillars.map((pillar) => (
            <View key={pillar.label} style={styles.pillarCard}>
              <View style={styles.pillarIconWrap}>
                <MaterialCommunityIcons name={pillar.icon} size={18} color={colors.techDark} />
              </View>
              <Text style={styles.pillarLabel}>{pillar.label}</Text>
            </View>
          ))}
        </View>

        <LinearGradient
          colors={['rgba(255,252,248,0.94)', 'rgba(248,239,231,0.94)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.statusCard}
        >
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>{copy.caption}</Text>
            <ActivityIndicator size="small" color={colors.primaryDark} />
          </View>
          <Text style={styles.statusText}>
            启动后会直接回到你的上次状态，不需要再从空页面重新找入口。
          </Text>
          <View style={styles.statusBarTrack}>
            <View style={styles.statusBarFill} />
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
  subtitle: {
    marginTop: spacing.sm,
    color: colors.inkSoft,
    fontSize: fontSize.lg,
    lineHeight: 26,
    maxWidth: 320,
  },
  pillarRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  pillarCard: {
    flex: 1,
    minHeight: 96,
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
    width: '68%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
})
