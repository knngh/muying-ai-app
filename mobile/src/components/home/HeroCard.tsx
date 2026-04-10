import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Button, Card, Chip, Text } from 'react-native-paper'
import LinearGradient from 'react-native-linear-gradient'
import type { StageSummary } from '../../utils/stage'
import { StandardCard } from '../layout'
import { colors, fontSize, spacing, borderRadius } from '../../theme'

interface HeroCardProps {
  stage: StageSummary
  status: string
  remainingAiText: string
  checkInStreak: number
  weeklyCompletionRate: number
  actionLabel: string
  onAction: () => void
}

export default function HeroCard({
  stage,
  status,
  remainingAiText,
  checkInStreak,
  weeklyCompletionRate,
  actionLabel,
  onAction,
}: HeroCardProps) {
  const statusLabel = status === 'active' ? '会员已开通' : '基础版'
  const helperText = status === 'active'
    ? '首页、日历与档案会围绕当前阶段持续联动。'
    : '升级后可解锁更完整的阶段联动与长期记录。'

  return (
    <StandardCard style={styles.heroCard} elevation={2}>
      <LinearGradient
        colors={['#FAE7DB', '#F2CDB6', '#ECD9C8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroGradient}
      >
      <View style={styles.heroGlow} />
      <View style={styles.heroRing} />
      <Card.Content style={styles.heroContent}>
        <View style={styles.heroTitleWrap}>
          <Chip style={styles.statusChip} textStyle={styles.statusChipText} compact>
            {statusLabel}
          </Chip>
          <Text style={styles.heroEyebrow}>当前阶段</Text>
          <Text style={styles.heroTitle}>{stage.title}</Text>
          <Text style={styles.heroSubtitle}>{helperText}</Text>
        </View>

        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{remainingAiText}</Text>
            <Text style={styles.heroStatLabel}>今日使用</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{checkInStreak}天</Text>
            <Text style={styles.heroStatLabel}>连续打卡</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{weeklyCompletionRate}%</Text>
            <Text style={styles.heroStatLabel}>本周完成</Text>
          </View>
        </View>

        <View style={styles.heroActionBar}>
          <Text style={styles.heroActionHint}>{stage.actionLabel}</Text>
          <Button
            mode={status === 'active' ? 'outlined' : 'contained'}
            buttonColor={status === 'active' ? undefined : colors.ink}
            textColor={status === 'active' ? colors.primaryDark : colors.white}
            onPress={onAction}
            style={[styles.heroActionBtn, status === 'active' && styles.heroActionBtnOutline]}
          >
            {status === 'active' ? actionLabel : '升级会员'}
          </Button>
        </View>
      </Card.Content>
      </LinearGradient>
    </StandardCard>
  )
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: borderRadius.xl,
    backgroundColor: 'transparent',
  },
  heroGradient: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    right: -40,
    top: -20,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255, 248, 240, 0.38)',
  },
  heroRing: {
    position: 'absolute',
    right: 32,
    top: 26,
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1,
    borderColor: 'rgba(159, 78, 46, 0.1)',
  },
  heroContent: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  heroTitleWrap: {
    gap: spacing.xs,
  },
  statusChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 253, 249, 0.92)',
    marginBottom: spacing.xs,
    borderRadius: borderRadius.pill,
  },
  statusChipText: {
    color: colors.primaryDark,
    fontWeight: '700',
    fontSize: fontSize.xs,
  },
  heroEyebrow: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  heroTitle: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '700',
  },
  heroSubtitle: {
    color: colors.inkSoft,
    fontSize: fontSize.md,
    lineHeight: 20,
    maxWidth: '78%',
  },
  heroActionBtn: {
    borderRadius: borderRadius.pill,
    borderColor: 'rgba(159, 78, 46, 0.18)',
  },
  heroActionBtnOutline: {
    backgroundColor: 'rgba(255, 253, 249, 0.82)',
  },
  heroStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255, 253, 249, 0.68)',
    borderWidth: 1,
    borderColor: 'rgba(159, 78, 46, 0.08)',
  },
  heroActionBar: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  heroActionHint: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 19,
  },
  heroStat: {
    alignItems: 'center',
    flex: 1,
  },
  heroStatLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginTop: 4,
  },
  heroStatValue: {
    color: colors.ink,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  heroStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.divider,
  },
})
