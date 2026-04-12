import React from 'react'
import { StyleSheet, View } from 'react-native'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { Text } from 'react-native-paper'
import { StandardCard } from '../layout'
import { colors, fontSize, spacing } from '../../theme'

interface StatsRowProps {
  usageLabel: string
  checkInStreak: number
  weeklyCompletionRate: number
}

export default function StatsRow({ usageLabel, checkInStreak, weeklyCompletionRate }: StatsRowProps) {
  const metrics = [
    {
      label: '今日使用',
      value: usageLabel,
      icon: 'flash-outline',
      accent: colors.copper,
      shell: 'rgba(185, 104, 66, 0.12)',
    },
    {
      label: '连续打卡',
      value: `${checkInStreak}`,
      icon: 'fire',
      accent: colors.primaryDark,
      shell: 'rgba(217, 138, 93, 0.14)',
    },
    {
      label: '周完成率',
      value: `${weeklyCompletionRate}%`,
      icon: 'chart-donut',
      accent: colors.techDark,
      shell: 'rgba(94, 126, 134, 0.12)',
    },
  ]

  return (
    <View style={styles.statRow}>
      {metrics.map((metric) => (
        <StandardCard key={metric.label} style={styles.statCard}>
          <View style={styles.statContent}>
            <View style={[styles.iconShell, { backgroundColor: metric.shell }]}>
              <MaterialCommunityIcons name={metric.icon} size={18} color={metric.accent} />
            </View>
            <Text style={styles.statLabel}>{metric.label}</Text>
            <Text style={styles.statValue}>{metric.value}</Text>
          </View>
        </StandardCard>
      ))}
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
    alignItems: 'flex-start',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
    minHeight: 78,
  },
  iconShell: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statLabel: {
    color: colors.inkSoft,
    fontSize: fontSize.xs,
    marginBottom: 1,
    fontWeight: '600',
  },
  statValue: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: colors.inkDeep,
  },
})
