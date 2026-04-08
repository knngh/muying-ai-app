import React from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { Text } from 'react-native-paper'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { colors, fontSize, spacing } from '../../theme'

export interface FeatureEntry {
  title: string
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
      {entries.map((entry) => (
        <TouchableOpacity
          key={entry.title}
          style={styles.quickActionItem}
          onPress={() => onPress(entry)}
          activeOpacity={0.7}
        >
          <View style={styles.quickActionIconBg}>
            <MaterialCommunityIcons name={entry.icon} size={28} color={colors.primary} />
          </View>
          <Text style={styles.quickActionText}>{entry.title}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  quickActionItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  quickActionIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionText: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: '500',
  },
})
