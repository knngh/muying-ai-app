import React, { useCallback } from 'react'
import { Alert, ScrollView, StyleSheet, View } from 'react-native'
import { Button, Card, Chip, Divider, Text } from 'react-native-paper'
import LinearGradient from 'react-native-linear-gradient'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import dayjs from 'dayjs'
import { useMembershipStore } from '../stores/membershipStore'
import { useAppStore } from '../stores/appStore'
import type { MembershipPlan } from '../stores/membershipStore'
import { trackAppEvent } from '../services/analytics'
import { ScreenContainer } from '../components/layout'
import { getStageSummary } from '../utils/stage'
import { colors, fontSize, spacing, borderRadius } from '../theme'

const comparisonRows = [
  { label: '问题助手', free: '每天 3 次', member: '连续追问' },
  { label: '阶段建议', free: '基础参考', member: '按当前阶段细分' },
  { label: '周度报告', free: '预览查看', member: '持续生成回顾' },
  { label: '成长档案', free: '基础记录', member: '长期沉淀 + 导出' },
  { label: '陪伴范围', free: '单点使用', member: '备孕到儿童阶段联动' },
]

const featureLabelMap = {
  ai_unlimited: '问题助手不限次',
  continuous_chat: '连续追问',
  weekly_report: '周报生成',
  growth_export: '成长档案导出',
  stage_circle: '阶段圈子',
  ad_free: '界面更清爽',
} satisfies Record<MembershipPlan['features'][number], string>

export default function MembershipScreen() {
  const navigation = useNavigation<any>()
  const user = useAppStore((state) => state.user)
  const { status, currentPlanCode, expireAt, aiUsedToday, plans, purchasePlan, ensureFreshQuota, loading } =
    useMembershipStore()
  const stage = getStageSummary(user)

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
      Alert.alert('开通成功', `${plan?.name || '会员'}已生效，可继续使用连续追问、周报和成长档案。`)
    } catch (_error) {
      Alert.alert('开通失败', '支付流程未完成，请稍后重试。')
    }
  }

  return (
    <ScreenContainer style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.heroCard}>
          <LinearGradient
            colors={[colors.primaryLight, '#F2D5C2', '#F7EEE4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
          <View style={styles.heroGlow} />
          <View style={styles.heroRing} />
          <Card.Content>
            <Text style={styles.heroEyebrow}>陪伴方案</Text>
            <View style={styles.heroTop}>
              <Chip style={styles.heroChip} textStyle={styles.heroChipText}>
                {status === 'active' ? '已开通' : '当前可开通'}
              </Chip>
              <Text style={styles.heroTitle}>把 {stage.lifecycleLabel} 的记录、问答和周报串成一条连续时间线</Text>
              <Text style={styles.heroSubtitle}>
                这里不是单次问答升级，而是把问题助手、成长日历、阶段周报和长期档案放进同一套陪伴流程。
              </Text>
            </View>

            <View style={styles.heroStats}>
              <View style={styles.heroStatCard}>
                <Text style={styles.heroStatLabel}>当前阶段</Text>
                <Text style={styles.heroStatValue}>
                  {stage.lifecycleLabel}
                </Text>
              </View>
              <View style={styles.heroStatCard}>
                <Text style={styles.heroStatLabel}>会员状态</Text>
                <Text style={styles.heroStatValue}>
                  {status === 'active' ? activePlan?.name || '已开通' : `今日已用 ${aiUsedToday} / 3 次`}
                </Text>
              </View>
              <View style={styles.heroStatCard}>
                <Text style={styles.heroStatLabel}>档案状态</Text>
                <Text style={styles.heroStatValue}>{status === 'active' ? '周报与档案已联动' : '开通后可持续沉淀记录'}</Text>
              </View>
            </View>

            <View style={styles.heroSignalRow}>
              <Chip compact style={styles.heroSignalChip} textStyle={styles.heroSignalChipText}>
                备孕到 3 岁以上全生命周期
              </Chip>
              <Chip compact style={styles.heroSignalChip} textStyle={styles.heroSignalChipText}>
                日历 + 问答 + 周报统一沉淀
              </Chip>
            </View>

            {status === 'active' && expireAt ? (
              <Text style={styles.expireText}>
                有效期至 {dayjs(expireAt).format('YYYY-MM-DD')}
              </Text>
            ) : null}

            {status === 'active' ? (
              <Button mode="contained" buttonColor={colors.ink} textColor={colors.white} onPress={() => navigation.navigate('WeeklyReport')} style={styles.heroButton}>
                查看本周阶段周报
              </Button>
            ) : null}
          </Card.Content>
          </LinearGradient>
        </Card>

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>方案选择</Text>
          <Text style={styles.sectionTitle}>选择更适合当前阶段的陪伴方式</Text>
          {plans.map((plan: MembershipPlan, index) => {
            const isActivePlan = currentPlanCode === plan.code && status === 'active'

            return (
              <Card key={plan.code} style={[styles.planCard, isActivePlan && styles.planCardActive]}>
                <Card.Content>
                  <View style={styles.planHeader}>
                    <View>
                      <Text style={styles.planIndex}>{`0${index + 1}`}</Text>
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

                  <View style={styles.planFeatureWrap}>
                    {plan.features.slice(0, 4).map((feature) => (
                      <Chip
                        key={`${plan.code}-${feature}`}
                        compact
                        style={styles.planFeatureChip}
                        textStyle={styles.planFeatureChipText}
                      >
                        {featureLabelMap[feature]}
                      </Chip>
                    ))}
                  </View>

                  <View style={styles.planFooter}>
                    <Text style={styles.planOriginalPrice}>
                      {plan.originalPrice ? `原价 ¥${plan.originalPrice}` : plan.monthlyPriceLabel}
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
          <Text style={styles.sectionEyebrow}>权益对比</Text>
          <Text style={styles.sectionTitle}>开通前后，能力会如何变化</Text>
          <Card style={styles.compareCard}>
            <Card.Content>
              <View style={styles.compareHeader}>
                <Text style={styles.compareHeaderLabel}>能力项</Text>
                <View style={styles.compareHeaderValues}>
                  <Text style={styles.compareHeaderFree}>基础</Text>
                  <Text style={styles.compareHeaderMember}>陪伴方案</Text>
                </View>
              </View>
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
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: 132,
  },
  heroCard: {
    borderRadius: borderRadius.xl,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroGradient: {
    borderRadius: borderRadius.xl,
  },
  heroGlow: {
    position: 'absolute',
    top: -24,
    right: -18,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 249, 244, 0.34)',
  },
  heroRing: {
    position: 'absolute',
    top: 22,
    right: 20,
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.12)',
  },
  heroEyebrow: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
  },
  heroTop: {
    gap: spacing.sm,
  },
  heroChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 253, 249, 0.9)',
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
    lineHeight: 32,
  },
  heroSubtitle: {
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.inkSoft,
  },
  heroStats: {
    flexDirection: 'column',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  heroStatCard: {
    flex: 1,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    backgroundColor: 'rgba(255, 253, 249, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.1)',
  },
  heroStatLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
  },
  heroStatValue: {
    color: colors.ink,
    fontSize: fontSize.md,
    fontWeight: '700',
    lineHeight: 22,
  },
  heroSignalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  heroSignalChip: {
    backgroundColor: 'rgba(255, 249, 243, 0.92)',
    borderColor: 'rgba(184,138,72,0.14)',
  },
  heroSignalChipText: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
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
  sectionEyebrow: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
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
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 0,
    shadowColor: colors.inkSoft,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
  },
  planCardActive: {
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: colors.accentLight,
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
  planIndex: {
    color: colors.textLight,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  planName: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
  },
  badgeChip: {
    backgroundColor: colors.goldLight,
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
  planFeatureWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  planFeatureChip: {
    backgroundColor: 'rgba(255, 249, 243, 0.94)',
    borderColor: 'rgba(184,138,72,0.12)',
  },
  planFeatureChipText: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  planOriginalPrice: {
    color: colors.textSecondary,
  },
  compareCard: {
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compareHeader: {
    paddingBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compareHeaderLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  compareHeaderValues: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  compareHeaderFree: {
    width: 72,
    textAlign: 'right',
    color: colors.textLight,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  compareHeaderMember: {
    width: 96,
    textAlign: 'right',
    color: colors.primaryDark,
    fontSize: fontSize.sm,
    fontWeight: '700',
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
