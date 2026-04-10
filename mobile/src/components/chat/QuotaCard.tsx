import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Button, Card, Chip, Text } from 'react-native-paper'
import LinearGradient from 'react-native-linear-gradient'
import { colors, fontSize, spacing, borderRadius } from '../../theme'

interface QuotaCardProps {
  status: string
  planName: string | undefined
  remainingCount: string
  subtitle?: string
  onUpgrade: () => void
}

export default function QuotaCard({
  status,
  planName,
  remainingCount,
  subtitle,
  onUpgrade,
}: QuotaCardProps) {
  if (status === 'active') {
    return (
      <Card style={[styles.quotaCard, styles.activeCard]}>
        <LinearGradient
          colors={['rgba(246,225,212,0.96)', 'rgba(250,240,231,0.92)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.quotaGradient}
        >
          <View style={styles.quotaGlow} />
          <View style={styles.quotaRing} />
          <Card.Content style={styles.activeContent}>
            <View style={styles.activeHeader}>
              <View style={styles.activeCopy}>
                <Text style={styles.quotaEyebrow}>陪伴状态</Text>
                <Text style={styles.activeTitle}>{planName || '贝护会员'}已开通</Text>
                <Text style={styles.activeSubtitle} numberOfLines={2}>
                  {subtitle || '已解锁多轮连续对话、周报联动与成长档案沉淀。'}
                </Text>
              </View>
              <Chip style={styles.quotaChip} textStyle={styles.quotaChipText}>
                剩余 {remainingCount}
              </Chip>
            </View>

            <View style={styles.activeMetricRow}>
              <View style={styles.activeMetric}>
                <Text style={styles.activeMetricTitle}>多轮追问</Text>
              </View>
              <View style={styles.activeMetric}>
                <Text style={styles.activeMetricTitle}>周报联动</Text>
              </View>
              <View style={styles.activeMetric}>
                <Text style={styles.activeMetricTitle}>成长记录</Text>
              </View>
            </View>
          </Card.Content>
        </LinearGradient>
      </Card>
    )
  }

  return (
    <Card style={styles.quotaCard}>
      <LinearGradient
        colors={[colors.primaryLight, '#F2D7C5', '#F7EEE5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.quotaGradient}
      >
      <View style={styles.quotaGlow} />
      <View style={styles.quotaRing} />
      <Card.Content>
        <View style={styles.quotaHeader}>
          <View>
            <Text style={styles.quotaEyebrow}>问题助手额度</Text>
            <Text style={styles.quotaTitle}>
              {status === 'active' ? planName || '贝护会员' : '今日可用次数'}
            </Text>
            <Text style={styles.quotaSubtitle}>
              {subtitle || (status === 'active'
                ? '已解锁多轮连续对话、生命周期周报和长期成长档案。'
                : '免费用户每天可使用 3 次，升级后可获得完整生命周期陪伴能力。')}
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
      </LinearGradient>
    </Card>
  )
}

const styles = StyleSheet.create({
  quotaCard: {
    borderRadius: borderRadius.xl,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeCard: {
    shadowColor: colors.shadowSoft,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  quotaGradient: {
    borderRadius: borderRadius.xl,
  },
  quotaGlow: {
    position: 'absolute',
    top: -24,
    right: -12,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 250, 244, 0.42)',
  },
  quotaRing: {
    position: 'absolute',
    top: 22,
    right: 18,
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: 'rgba(159,78,46,0.1)',
  },
  activeContent: {
    gap: spacing.md,
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  activeCopy: {
    flex: 1,
  },
  activeTitle: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  activeSubtitle: {
    marginTop: spacing.xs,
    color: colors.inkSoft,
    lineHeight: 20,
  },
  activeMetricRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  activeMetric: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(255, 250, 246, 0.84)',
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.12)',
  },
  activeMetricTitle: {
    color: colors.primaryDark,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  quotaHeader: {
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  quotaEyebrow: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginBottom: spacing.xs,
  },
  quotaTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
  },
  quotaSubtitle: {
    marginTop: spacing.xs,
    maxWidth: 220,
    color: colors.inkSoft,
    lineHeight: 20,
  },
  quotaChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 253, 249, 0.86)',
    borderRadius: borderRadius.pill,
  },
  quotaChipText: {
    color: colors.gold,
    fontWeight: '700',
  },
})
