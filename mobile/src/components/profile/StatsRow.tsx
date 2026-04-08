import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Card, Text } from 'react-native-paper'
import { StandardCard } from '../layout'
import { colors, fontSize, spacing } from '../../theme'

interface StatsRowProps {
  usageLabel: string
  checkInStreak: number
  weeklyCompletionRate: number
}

export default function StatsRow({ usageLabel, checkInStreak, weeklyCompletionRate }: StatsRowProps) {
  return (
    <View style={styles.statRow}>
      <StandardCard style={styles.statCard}>
        <Card.Content style={styles.statContent}>
          <Text style={styles.statLabel}>今日使用</Text>
          <Text style={styles.statValue}>{usageLabel}</Text>
        </Card.Content>
      </StandardCard>
      <StandardCard style={styles.statCard}>
        <Card.Content style={styles.statContent}>
          <Text style={styles.statLabel}>连续打卡</Text>
          <Text style={styles.statValue}>{checkInStreak}</Text>
        </Card.Content>
      </StandardCard>
      <StandardCard style={styles.statCard}>
        <Card.Content style={styles.statContent}>
          <Text style={styles.statLabel}>周完成率</Text>
          <Text style={styles.statValue}>{weeklyCompletionRate}%</Text>
        </Card.Content>
      </StandardCard>
    </View>
  )
}

const styles = StyleSheet.create({
  statRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    marginBottom: 0,
  },
  statContent: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.text,
  },
})
