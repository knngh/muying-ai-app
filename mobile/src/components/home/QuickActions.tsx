import React from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { Text } from 'react-native-paper'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { colors, spacing, borderRadius } from '../../theme'

type TabFeatureEntry = {
  title: string
  subtitle: string
  icon: string
  route: 'Chat' | 'Knowledge'
  type: 'tab'
}

type StackFeatureEntry = {
  title: string
  subtitle: string
  icon: string
  route: 'Calendar' | 'Membership' | 'WeeklyReport' | 'PregnancyProfile'
  type: 'stack'
}

export type FeatureEntry = TabFeatureEntry | StackFeatureEntry

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
            <MaterialCommunityIcons name={entry.icon} size={20} color={colors.primary} />
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
    gap: spacing.xs + 2,
    flexBasis: '47%',
    flexGrow: 1,
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.md - 2,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadowSoft,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    minHeight: 112,
  },
  quickActionTopRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickActionIndex: {
    color: colors.textLight,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.9,
  },
  quickActionDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(94,126,134,0.24)',
  },
  quickActionIconBg: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(198,106,74,0.14)',
  },
  quickActionText: {
    fontSize: 13,
    color: colors.inkDeep,
    fontWeight: '700',
  },
  quickActionSubtitle: {
    fontSize: 10,
    color: colors.textSecondary,
    lineHeight: 15,
  },
})
