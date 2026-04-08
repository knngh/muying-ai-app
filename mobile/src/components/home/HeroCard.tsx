import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Button, Card, Chip, Text } from 'react-native-paper'
import type { StageSummary } from '../../utils/stage'
import { StandardCard } from '../layout'
import { colors, fontSize, spacing, borderRadius } from '../../theme'

interface HeroCardProps {
  stage: StageSummary
  status: string
  remainingAiText: string
  checkInStreak: number
  weeklyCompletionRate: number
  onAction: () => void
}

export default function HeroCard({
  stage,
  status,
  remainingAiText,
  checkInStreak,
  weeklyCompletionRate,
  onAction,
}: HeroCardProps) {
  return (
    <StandardCard style={styles.heroCard} elevation={2}>
      <Card.Content>
        <View style={styles.heroTop}>
          <View style={styles.heroTitleWrap}>
            <Chip style={styles.statusChip} textStyle={styles.statusChipText} compact>
              {status === 'active' ? '会员已开通' : '免费版'}
            </Chip>
            <Text style={styles.heroTitle}>{stage.title}</Text>
            <Text style={styles.heroSubtitle}>{stage.subtitle}</Text>
          </View>

          <Button
            mode={status === 'active' ? 'outlined' : 'contained'}
            buttonColor={status === 'active' ? undefined : colors.white}
            textColor={status === 'active' ? colors.white : colors.ink}
            onPress={onAction}
            style={styles.heroActionBtn}
          >
            {status === 'active' ? '查看日历' : '升级会员'}
          </Button>
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
      </Card.Content>
    </StandardCard>
  )
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.xl,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  heroTitleWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  statusChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    marginBottom: spacing.xs,
    borderRadius: borderRadius.pill,
  },
  statusChipText: {
    color: colors.primaryDark,
    fontWeight: '700',
    fontSize: fontSize.xs,
  },
  heroTitle: {
    color: colors.ink,
    fontSize: fontSize.heroTitle,
    fontWeight: '700',
  },
  heroSubtitle: {
    color: colors.inkSoft,
    fontSize: fontSize.sm,
  },
  heroActionBtn: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.pill,
  },
  heroStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  heroStat: {
    alignItems: 'center',
    flex: 1,
  },
  heroStatLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  heroStatValue: {
    color: colors.ink,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  heroStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.divider,
  },
})
