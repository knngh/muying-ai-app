import React, { useCallback } from 'react'
import { Alert, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native'
import { Button, Card, Chip, Divider, Text } from 'react-native-paper'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import dayjs from 'dayjs'
import { useMembershipStore } from '../stores/membershipStore'
import type { MembershipPlan } from '../stores/membershipStore'
import { trackAppEvent } from '../services/analytics'
import { colors, fontSize, spacing, borderRadius } from '../theme'

const comparisonRows = [
  { label: '问题助手', free: '3 次/天', member: '不限次' },
  { label: '对话模式', free: '单轮问答', member: '多轮连续对话' },
  { label: '周度报告', free: '不可用', member: '每周 1 份' },
  { label: '成长档案', free: '基础记录', member: '图表 + 导出' },
  { label: '社区权益', free: '浏览 / 发帖', member: '阶段圈子 + 标识' },
]

export default function MembershipScreen() {
  const navigation = useNavigation<any>()
  const { status, currentPlanCode, expireAt, aiUsedToday, plans, purchasePlan, ensureFreshQuota, loading } =
    useMembershipStore()

  const activePlan = plans.find((item: MembershipPlan) => item.code === currentPlanCode)

  useFocusEffect(
    useCallback(() => {
      ensureFreshQuota()
      void trackAppEvent('app_membership_exposure', {
        page: 'MembershipScreen',
        properties: {
          status,
          currentPlanCode,
          aiUsedToday,
          planCount: plans.length,
        },
      })
    }, [aiUsedToday, currentPlanCode, ensureFreshQuota, plans.length, status]),
  )

  const handlePurchase = async (code: 'monthly' | 'quarterly' | 'yearly') => {
    try {
      await purchasePlan(code)
      const plan = plans.find((item: MembershipPlan) => item.code === code)
      Alert.alert('开通成功', `${plan?.name || '会员'} 已生效，问题助手权益已切换为不限次使用。`)
    } catch (_error) {
      Alert.alert('开通失败', '支付流程未完成，请稍后重试。')
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.heroCard}>
          <Card.Content>
            <View style={styles.heroTop}>
              <Chip style={styles.heroChip} textStyle={styles.heroChipText}>
                {status === 'active' ? '会员已开通' : '首月限时 ¥9.9'}
              </Chip>
              <Text style={styles.heroTitle}>把 App 变成你的深度陪伴工具</Text>
              <Text style={styles.heroSubtitle}>
                问题助手不限次、个性化周度报告、阶段专属内容和更完整的成长记录都在这里。
              </Text>
            </View>

            <View style={styles.heroStats}>
              <View style={styles.heroStatCard}>
                <Text style={styles.heroStatLabel}>当前状态</Text>
                <Text style={styles.heroStatValue}>
                  {status === 'active' ? activePlan?.name || '已开通会员' : '免费用户'}
                </Text>
              </View>
              <View style={styles.heroStatCard}>
                <Text style={styles.heroStatLabel}>今日使用次数</Text>
                <Text style={styles.heroStatValue}>
                  {status === 'active' ? `${aiUsedToday} 次` : `${aiUsedToday} / 3 次`}
                </Text>
              </View>
            </View>

            {status === 'active' && expireAt ? (
              <Text style={styles.expireText}>
                有效期至 {dayjs(expireAt).format('YYYY-MM-DD')}
              </Text>
            ) : null}

            {status === 'active' ? (
              <Button mode="contained" buttonColor={colors.white} textColor={colors.ink} onPress={() => navigation.navigate('WeeklyReport')} style={styles.heroButton}>
                查看我的周度报告
              </Button>
            ) : null}
          </Card.Content>
        </Card>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>套餐选择</Text>
          {plans.map((plan: MembershipPlan) => {
            const isActivePlan = currentPlanCode === plan.code && status === 'active'

            return (
              <Card key={plan.code} style={[styles.planCard, isActivePlan && styles.planCardActive]}>
                <Card.Content>
                  <View style={styles.planHeader}>
                    <View>
                      <View style={styles.planNameRow}>
                        <Text style={styles.planName}>{plan.name}</Text>
                        {plan.badge ? (
                          <Chip compact style={styles.badgeChip} textStyle={styles.badgeText}>
                            {plan.badge}
                          </Chip>
                        ) : null}
                      </View>
                      <Text style={styles.planDesc}>{plan.description}</Text>
                    </View>
                    <View style={styles.planPriceWrap}>
                      <Text style={styles.planPrice}>¥{plan.price}</Text>
                      <Text style={styles.planMonthlyPrice}>{plan.monthlyPriceLabel}</Text>
                    </View>
                  </View>

                  <View style={styles.planFooter}>
                    <Text style={styles.planOriginalPrice}>
                      划线价 {plan.originalPrice ? `¥${plan.originalPrice}` : '无'}
                    </Text>
                    <Button
                      mode={isActivePlan ? 'outlined' : 'contained'}
                      onPress={() => handlePurchase(plan.code)}
                      buttonColor={isActivePlan ? undefined : colors.ink}
                      textColor={isActivePlan ? colors.ink : colors.white}
                      loading={loading}
                      disabled={loading}
                    >
                      {isActivePlan ? '续费' : '立即开通'}
                    </Button>
                  </View>
                </Card.Content>
              </Card>
            )
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>权益对比</Text>
          <Card style={styles.compareCard}>
            <Card.Content>
              {comparisonRows.map((row, index) => (
                <View key={row.label}>
                  <View style={styles.compareRow}>
                    <Text style={styles.compareLabel}>{row.label}</Text>
                    <View style={styles.compareValues}>
                      <Text style={styles.compareFree}>{row.free}</Text>
                      <Text style={styles.compareMember}>{row.member}</Text>
                    </View>
                  </View>
                  {index < comparisonRows.length - 1 ? <Divider /> : null}
                </View>
              ))}
            </Card.Content>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  heroCard: {
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primaryLight,
  },
  heroTop: {
    gap: spacing.sm,
  },
  heroChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderRadius: borderRadius.pill,
  },
  heroChipText: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  heroTitle: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.ink,
  },
  heroSubtitle: {
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.inkSoft,
  },
  heroStats: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  heroStatCard: {
    flex: 1,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    backgroundColor: colors.white,
  },
  heroStatLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
  },
  heroStatValue: {
    color: colors.ink,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  expireText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
  },
  heroButton: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    borderRadius: borderRadius.pill,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.md,
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
  },
  planCard: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.white,
    elevation: 0,
    shadowColor: colors.inkSoft,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
  },
  planCardActive: {
    borderWidth: 1.5,
    borderColor: colors.gold,
    backgroundColor: colors.goldLight,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  planNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  planName: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
  },
  badgeChip: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.pill,
  },
  badgeText: {
    color: colors.gold,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  planDesc: {
    color: colors.textSecondary,
    lineHeight: 20,
    maxWidth: 190,
  },
  planPriceWrap: {
    alignItems: 'flex-end',
  },
  planPrice: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.ink,
  },
  planMonthlyPrice: {
    color: colors.textSecondary,
  },
  planFooter: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planOriginalPrice: {
    color: colors.textSecondary,
  },
  compareCard: {
    borderRadius: borderRadius.xl,
    backgroundColor: colors.white,
  },
  compareRow: {
    paddingVertical: spacing.md,
  },
  compareLabel: {
    marginBottom: spacing.sm,
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
  },
  compareValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  compareFree: {
    flex: 1,
    color: colors.textLight,
  },
  compareMember: {
    flex: 1,
    color: colors.primaryDark,
    fontWeight: '700',
    textAlign: 'right',
  },
})
