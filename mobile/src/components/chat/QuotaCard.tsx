import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Button, Card, Chip, Text } from 'react-native-paper'
import { colors, fontSize, spacing, borderRadius } from '../../theme'

interface QuotaCardProps {
  status: string
  planName: string | undefined
  remainingCount: string
  onUpgrade: () => void
}

export default function QuotaCard({ status, planName, remainingCount, onUpgrade }: QuotaCardProps) {
  return (
    <Card style={styles.quotaCard}>
      <Card.Content>
        <View style={styles.quotaHeader}>
          <View>
            <Text style={styles.quotaTitle}>
              {status === 'active' ? planName || '贝护会员' : '今日可用次数'}
            </Text>
            <Text style={styles.quotaSubtitle}>
              {status === 'active'
                ? '已解锁多轮连续对话和周度报告。'
                : '免费用户每天可使用 3 次，升级后不限次数。'}
            </Text>
          </View>
          <Chip style={styles.quotaChip} textStyle={styles.quotaChipText}>
            剩余 {remainingCount}
          </Chip>
        </View>

        {status !== 'active' ? (
          <Button mode="contained" buttonColor={colors.ink} onPress={onUpgrade}>
            解锁不限次使用
          </Button>
        ) : null}
      </Card.Content>
    </Card>
  )
}

const styles = StyleSheet.create({
  quotaCard: {
    borderRadius: borderRadius.xl,
    backgroundColor: colors.white,
  },
  quotaHeader: {
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  quotaTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
  },
  quotaSubtitle: {
    marginTop: spacing.xs,
    maxWidth: 220,
    color: colors.textLight,
    lineHeight: 20,
  },
  quotaChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.goldLight,
    borderRadius: borderRadius.pill,
  },
  quotaChipText: {
    color: colors.gold,
    fontWeight: '700',
  },
})
