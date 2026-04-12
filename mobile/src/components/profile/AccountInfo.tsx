import React from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { Text } from 'react-native-paper'
import { StandardCard } from '../layout'
import { colors, fontSize, spacing, borderRadius } from '../../theme'

interface AccountInfoProps {
  rows: Array<{ label: string; value: string }>
  onPress: () => void
}

export default function AccountInfo({ rows, onPress }: AccountInfoProps) {
  const spotlightRows = rows.slice(0, 4)
  const detailRows = rows.slice(4)

  const resolveIcon = (label: string) => {
    if (label.includes('用户名')) return 'account-circle-outline'
    if (label.includes('手机号')) return 'cellphone'
    if (label.includes('邮箱')) return 'email-outline'
    if (label.includes('当前阶段')) return 'timeline-text-outline'
    if (label.includes('预产期') || label.includes('生日')) return 'calendar-range'
    if (label.includes('孩子昵称')) return 'baby-face-outline'
    if (label.includes('照护者')) return 'account-heart-outline'
    if (label.includes('性别')) return 'human-male-female'
    if (label.includes('分娩')) return 'hospital-box-outline'
    if (label.includes('喂养')) return 'food-apple-outline'
    if (label.includes('关注')) return 'radar'
    return 'chevron-right'
  }

  return (
    <StandardCard>
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>资料面板</Text>
        <Text style={styles.hint}>点击任一条可统一编辑资料</Text>
      </View>
      <View style={styles.gridWrap}>
        {spotlightRows.map((row) => (
          <TouchableOpacity key={row.label} style={styles.spotlightCard} onPress={onPress} activeOpacity={0.88}>
            <View style={styles.spotlightIconShell}>
              <MaterialCommunityIcons
                name={resolveIcon(row.label)}
                size={16}
                color={colors.techDark}
              />
            </View>
            <Text style={styles.spotlightLabel}>{row.label}</Text>
            <Text style={styles.spotlightValue} numberOfLines={2}>
              {row.value}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.listSection}>
        {detailRows.map((row, index) => (
          <TouchableOpacity
            key={row.label}
            style={[styles.listItem, index === detailRows.length - 1 && styles.listItemLast]}
            onPress={onPress}
            activeOpacity={0.86}
          >
            <View style={styles.listLeft}>
              <View style={styles.detailIconShell}>
                <MaterialCommunityIcons
                  name={resolveIcon(row.label)}
                  size={15}
                  color={colors.primaryDark}
                />
              </View>
              <View style={styles.listTextWrap}>
                <Text style={styles.listItemTitle}>{row.label}</Text>
                <Text style={styles.listItemDescription} numberOfLines={2}>
                  {row.value}
                </Text>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.primaryDark} />
          </TouchableOpacity>
        ))}
      </View>
    </StandardCard>
  )
}

const styles = StyleSheet.create({
  headerRow: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  eyebrow: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  hint: {
    color: colors.textLight,
    fontSize: fontSize.xs,
  },
  gridWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs + 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  spotlightCard: {
    width: '48%',
    minHeight: 82,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 3,
    backgroundColor: 'rgba(255, 250, 246, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(94, 126, 134, 0.12)',
  },
  spotlightIconShell: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(94, 126, 134, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  spotlightLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginBottom: 2,
  },
  spotlightValue: {
    color: colors.inkDeep,
    fontSize: fontSize.sm,
    fontWeight: '700',
    lineHeight: 16,
  },
  listSection: {
    marginVertical: 0,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: spacing.xs,
  },
  listItem: {
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(63, 42, 34, 0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.xs + 3,
  },
  listItemLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  listLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  detailIconShell: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(185, 104, 66, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listTextWrap: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  listItemDescription: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: '700',
    marginTop: 2,
  },
})
