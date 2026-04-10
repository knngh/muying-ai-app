import React from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { Text } from 'react-native-paper'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { colors, fontSize, spacing, borderRadius } from '../../theme'

export interface FeatureEntry {
  title: string
  subtitle: string
  icon: string
  route: 'Chat' | 'Knowledge' | 'Calendar' | 'Membership' | 'WeeklyReport'
  type: 'tab' | 'stack'
}

interface QuickActionsProps {
  entries: FeatureEntry[]
  onPress: (entry: FeatureEntry) => void
}

export default function QuickActions({ entries, onPress }: QuickActionsProps) {
  return (
    <View style={styles.quickActionsRow}>
      {entries.map((entry, index) => (
        <TouchableOpacity
          key={entry.title}
          style={styles.quickActionItem}
          onPress={() => onPress(entry)}
          activeOpacity={0.7}
        >
          <View style={styles.quickActionTopRow}>
            <Text style={styles.quickActionIndex}>{String(index + 1).padStart(2, '0')}</Text>
            <View style={styles.quickActionDot} />
          </View>
          <View style={styles.quickActionIconBg}>
            <MaterialCommunityIcons name={entry.icon} size={24} color={colors.primary} />
          </View>
          <Text style={styles.quickActionText}>{entry.title}</Text>
          <Text style={styles.quickActionSubtitle}>{entry.subtitle}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  quickActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickActionItem: {
    alignItems: 'flex-start',
    gap: spacing.sm,
    width: '48%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255, 249, 243, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.12)',
    shadowColor: colors.shadowSoft,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    minHeight: 132,
  },
  quickActionTopRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickActionIndex: {
    color: colors.textLight,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  quickActionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(94,126,134,0.24)',
  },
  quickActionIconBg: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: 'rgba(248, 230, 213, 0.86)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(197,108,71,0.1)',
  },
  quickActionText: {
    fontSize: fontSize.md,
    color: colors.inkDeep,
    fontWeight: '700',
  },
  quickActionSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 18,
  },
})
