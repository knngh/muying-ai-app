import React, { useCallback, useMemo } from 'react'
import { Alert, ScrollView, StyleSheet, View } from 'react-native'
import { Button, Card, Chip, Text } from 'react-native-paper'
import LinearGradient from 'react-native-linear-gradient'
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import dayjs from 'dayjs'
import { useMembershipStore } from '../stores/membershipStore'
import { useAppStore } from '../stores/appStore'
import type { MembershipPlan } from '../stores/membershipStore'
import { trackAppEvent } from '../services/analytics'
import { ScreenContainer } from '../components/layout'
import { getStageSummary } from '../utils/stage'
import { colors, fontSize, spacing, borderRadius } from '../theme'
import type { RootStackParamList } from '../navigation/AppNavigator'

const comparisonRows = [
  {
    label: '阅读问答',
    freeTitle: '每天 3 次',
    freeDetail: '适合偶尔查一个问题，用完当天就要等刷新。',
    memberTitle: '不限次连续追问',
    memberDetail: '可以围绕同一个症状、检查或喂养问题继续追问细节。',
    impactLabel: '一次问透',
    impactText: '适合把一次咨询问清楚，而不是拆成几天问。',
  },
  {
    label: '阶段建议',
    freeTitle: '通用阶段提示',
    freeDetail: '能看到当前阶段的基础提醒，但不会把问答、日历和档案串起来。',
    memberTitle: '按当前阶段细分',
    memberDetail: '结合孕周/宝宝月龄，把产检、胎动、喂养、睡眠等重点拆成下一步。',
    impactLabel: '下一步明确',
    impactText: '更容易知道今天先做什么、后面要跟什么。',
  },
  {
    label: '周度报告',
    freeTitle: '只看预览',
    freeDetail: '能看到部分亮点，但完整回顾和建议不会持续沉淀。',
    memberTitle: '完整周报持续生成',
    memberDetail: '把本周问答、签到、日历完成度和阶段重点整理成回顾。',
    impactLabel: '每周复盘',
    impactText: '适合每周复盘，也方便和家人同步重点。',
  },
  {
    label: '成长档案',
    freeTitle: '基础记录',
    freeDetail: '可以查看阶段资料，但长期趋势和摘要能力有限。',
    memberTitle: '长期沉淀 + 导出',
    memberDetail: '把关键变化、阶段记录、周报结论沉淀成可回看的时间线。',
    impactLabel: '方便回看',
    impactText: '产检、喂养、发育变化不容易散落在聊天记录里。',
  },
  {
    label: '陪伴范围',
    freeTitle: '单点使用',
    freeDetail: '每次打开解决一个点，离开后上下文容易断。',
    memberTitle: '备孕到儿童阶段联动',
    memberDetail: '同一套日历、问答、周报和档案持续覆盖不同阶段。',
    impactLabel: '持续陪伴',
    impactText: '从孕期到育儿，信息不需要反复重新整理。',
  },
]

const featureLabelMap = {
  ai_unlimited: '阅读问答不限次',
  continuous_chat: '连续追问',
  weekly_report: '周报生成',
  growth_export: '成长档案导出',
  stage_circle: '阶段圈子',
  ad_free: '界面更清爽',
} satisfies Record<MembershipPlan['features'][number], string>

const hiddenFeatures = new Set<MembershipPlan['features'][number]>(['stage_circle'])

type MembershipContextCard = {
  title: string
  description: string
  highlights: string[]
  actionLabel: string
  action: 'growth_archive' | 'weekly_report'
}

export default function MembershipScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'Membership'>>()
  const route = useRoute<RouteProp<RootStackParamList, 'Membership'>>()
  const user = useAppStore((state) => state.user)
  const { status, currentPlanCode, expireAt, aiUsedToday, plans, purchasePlan, ensureFreshQuota, loading } =
    useMembershipStore()
  const stage = getStageSummary(user)
  const source = route.params?.source
  const entryAction = route.params?.entryAction
  const highlight = route.params?.highlight

  const activePlan = plans.find((item: MembershipPlan) => item.code === currentPlanCode)
  const contextCard = useMemo<MembershipContextCard | null>(() => {
    if (status === 'active') {
      return null
    }

    if (source === 'growth_archive') {
      return {
        title: '别让成长档案停在预览版',
        description: highlight || '你刚刚看到的档案、时间轴和导出摘要，只有和周报、连续问答打通后才会真正有复盘价值。',
        highlights: ['完整档案摘要可导出', '阶段周报继续累计', '关键变化能留给家人共享'],
        actionLabel: '先看档案预览',
        action: 'growth_archive',
      }
    }

    return {
      title: '把这次打开延续成下一次还会回来',
      description: highlight || '你是从首页任务链路里进来的，现在最该补的是让签到、周报、问答和档案形成连续反馈。',
      highlights: ['连续追问不中断', '周报不再只看预览', '日历与档案能沉淀成时间线'],
      actionLabel: '先看成长档案',
      action: 'growth_archive',
    }
  }, [highlight, source, status])

  const heroSubtitle = useMemo(() => {
    if (status === 'active') {
      return '这里不是单次问答升级，而是把阅读问答、成长日历、阶段周报和成长档案放进同一套陪伴流程。'
    }

    if (source === 'growth_archive') {
      return '你刚从成长档案预览进来，开通后才能把阶段时间轴、周报沉淀和导出摘要真正串起来。'
    }

    if (source === 'home_retention' || source === 'home_upgrade') {
      return '你刚从首页任务链路进来，开通后签到、周报、阅读问答和成长档案会形成连续反馈，而不是一次性使用。'
    }

    return '这里不是单次问答升级，而是把阅读问答、成长日历、阶段周报和成长档案放进同一套陪伴流程。'
  }, [source, status])
  const heroTitle = status === 'active' ? `${stage.lifecycleLabel} 陪伴已联动` : `升级 ${stage.lifecycleLabel} 陪伴方案`
  const heroStatusText = status === 'active' ? activePlan?.name || '已开通' : `今日已用 ${aiUsedToday} / 3 次`
  const heroArchiveText = status === 'active' ? '周报与档案已联动' : '开通后持续沉淀'
  const heroExpireText = status === 'active' && expireAt ? `有效期至 ${dayjs(expireAt).format('YYYY-MM-DD')}` : '日历 + 问答 + 周报'

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
          source,
          entryAction,
        },
      })

      if (contextCard) {
        void trackAppEvent('app_membership_context_exposure', {
          page: 'MembershipScreen',
          properties: {
            source,
            action: contextCard.action,
            highlightCount: contextCard.highlights.length,
          },
        })
      }
    }, [aiUsedToday, contextCard, currentPlanCode, ensureFreshQuota, entryAction, plans.length, source, status]),
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

  const handleContextAction = () => {
    if (!contextCard) {
      return
    }

    void trackAppEvent('app_membership_context_click', {
      page: 'MembershipScreen',
      properties: {
        source,
        action: contextCard.action,
        highlight,
      },
    })

    if (contextCard.action === 'weekly_report') {
      navigation.navigate('WeeklyReport')
      return
    }

    navigation.navigate('GrowthArchive', {
      source: 'membership',
      focus: source === 'growth_archive' ? 'export' : 'timeline',
    })
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
              <View style={styles.heroHeaderRow}>
                <Text style={styles.heroEyebrow}>陪伴方案</Text>
                <Chip compact style={styles.heroChip} textStyle={styles.heroChipText}>
                {status === 'active' ? '已开通' : '当前可开通'}
                </Chip>
              </View>
              <Text style={styles.heroTitle}>{heroTitle}</Text>
              <Text numberOfLines={1} style={styles.heroSubtitle}>
                {heroSubtitle}
              </Text>

              <View style={styles.heroSummaryGrid}>
                <View style={styles.heroSummaryItem}>
                  <Text style={styles.heroSummaryLabel}>当前阶段</Text>
                  <Text style={styles.heroSummaryValue}>{stage.lifecycleLabel}</Text>
                </View>
                <View style={styles.heroSummaryItem}>
                  <Text style={styles.heroSummaryLabel}>会员状态</Text>
                  <Text style={styles.heroSummaryValue}>{heroStatusText}</Text>
                </View>
                <View style={styles.heroSummaryItem}>
                  <Text style={styles.heroSummaryLabel}>档案状态</Text>
                  <Text style={styles.heroSummaryValue}>{heroArchiveText}</Text>
                </View>
                <View style={styles.heroSummaryItem}>
                  <Text style={styles.heroSummaryLabel}>有效信息</Text>
                  <Text style={styles.heroSummaryValue}>{heroExpireText}</Text>
                </View>
              </View>

            </Card.Content>
          </LinearGradient>
        </Card>

        {contextCard ? (
          <Card style={styles.contextCard}>
            <Card.Content>
              <Text style={styles.contextEyebrow}>当前断点</Text>
              <Text style={styles.contextTitle}>{contextCard.title}</Text>
              <Text style={styles.contextDescription}>{contextCard.description}</Text>
              <View style={styles.contextChipRow}>
                {contextCard.highlights.map((item) => (
                  <Chip
                    key={item}
                    compact
                    style={styles.contextChip}
                    textStyle={styles.contextChipText}
                  >
                    {item}
                  </Chip>
                ))}
              </View>
              <Button
                mode="contained-tonal"
                onPress={handleContextAction}
                style={styles.contextButton}
                textColor={colors.ink}
              >
                {contextCard.actionLabel}
              </Button>
            </Card.Content>
          </Card>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>方案选择</Text>
          <Text style={styles.sectionTitle}>选择更适合当前阶段的陪伴方式</Text>
          {plans.map((plan: MembershipPlan, index) => {
            const isActivePlan = currentPlanCode === plan.code && status === 'active'

            return (
              <Card key={plan.code} style={[styles.planCard, isActivePlan && styles.planCardActive]}>
                <Card.Content style={styles.planCardContent}>
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
                      <Text numberOfLines={2} style={styles.planDesc}>{plan.description}</Text>
                    </View>
                    <View style={styles.planPriceWrap}>
                      <Text style={styles.planPrice}>¥{plan.price}</Text>
                      <Text style={styles.planMonthlyPrice}>{plan.monthlyPriceLabel}</Text>
                    </View>
                  </View>

                  <View style={styles.planFeatureWrap}>
                    {plan.features.filter((feature) => !hiddenFeatures.has(feature)).slice(0, 4).map((feature) => (
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
                      compact
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
          <Text style={styles.sectionTitle}>开通后具体多了什么</Text>
          <Text style={styles.sectionDescription}>不是简单把次数变多，而是把问答、日历、周报和档案连成可持续使用的流程。</Text>
          <View style={styles.compareSummaryRow}>
            <View style={styles.compareSummaryCard}>
              <Text style={styles.compareSummaryNumber}>3 次</Text>
              <Text style={styles.compareSummaryLabel}>基础版每日问答</Text>
            </View>
            <View style={[styles.compareSummaryCard, styles.compareSummaryCardMember]}>
              <Text style={styles.compareSummaryNumber}>不限次</Text>
              <Text style={styles.compareSummaryLabel}>会员连续追问</Text>
            </View>
          </View>
          {comparisonRows.map((row) => (
            <Card key={row.label} style={styles.compareCard}>
              <Card.Content style={styles.compareCardContent}>
                <View style={styles.compareRowHeader}>
                  <Text style={styles.compareLabel}>{row.label}</Text>
                  <Chip compact style={styles.compareImpactChip} textStyle={styles.compareImpactChipText}>
                    {row.impactLabel}
                  </Chip>
                </View>
                <View style={styles.compareColumnWrap}>
                  <View style={styles.compareColumn}>
                    <Text style={styles.compareColumnEyebrow}>基础版</Text>
                    <Text style={styles.compareFreeTitle}>{row.freeTitle}</Text>
                    <Text numberOfLines={2} style={styles.compareDetail}>{row.freeDetail}</Text>
                  </View>
                  <View style={[styles.compareColumn, styles.compareColumnMember]}>
                    <Text style={styles.compareColumnEyebrowMember}>开通后</Text>
                    <Text style={styles.compareMemberTitle}>{row.memberTitle}</Text>
                    <Text numberOfLines={2} style={styles.compareMemberDetail}>{row.memberDetail}</Text>
                  </View>
                </View>
                <Text numberOfLines={1} style={styles.compareImpactText}>{row.impactText}</Text>
              </Card.Content>
            </Card>
          ))}
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
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  heroChip: {
    backgroundColor: 'rgba(255, 253, 249, 0.9)',
    borderRadius: borderRadius.pill,
  },
  heroChipText: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  heroTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.ink,
    lineHeight: 28,
  },
  heroSubtitle: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.inkSoft,
  },
  heroSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  heroSummaryItem: {
    width: '48%',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(255, 253, 249, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.1)',
  },
  heroSummaryLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginBottom: 2,
  },
  heroSummaryValue: {
    color: colors.ink,
    fontSize: fontSize.sm,
    fontWeight: '700',
    lineHeight: 19,
  },
  contextCard: {
    marginTop: spacing.lg,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  contextEyebrow: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  contextTitle: {
    marginTop: spacing.xs,
    color: colors.ink,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  contextDescription: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  contextChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  contextChip: {
    backgroundColor: colors.goldLight,
  },
  contextChipText: {
    color: colors.gold,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  contextButton: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(248,227,214,0.92)',
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
  sectionDescription: {
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  planCard: {
    marginBottom: spacing.sm,
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
  planCardContent: {
    paddingVertical: spacing.md,
  },
  planCardActive: {
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: colors.accentLight,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
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
    marginBottom: 2,
  },
  planName: {
    fontSize: fontSize.lg,
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
    fontSize: fontSize.sm,
    lineHeight: 19,
    maxWidth: 190,
  },
  planPriceWrap: {
    alignItems: 'flex-end',
  },
  planPrice: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.ink,
  },
  planMonthlyPrice: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  planFooter: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planFeatureWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
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
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  compareCard: {
    marginBottom: spacing.sm,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compareCardContent: {
    paddingVertical: spacing.md,
  },
  compareSummaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  compareSummaryCard: {
    flex: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    backgroundColor: '#F7F4EE',
    borderWidth: 1,
    borderColor: colors.border,
  },
  compareSummaryCardMember: {
    backgroundColor: colors.accentLight,
    borderColor: 'rgba(184,138,72,0.22)',
  },
  compareSummaryNumber: {
    color: colors.ink,
    fontSize: fontSize.lg,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  compareSummaryLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  compareRowHeader: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  compareLabel: {
    fontSize: fontSize.md,
    fontWeight: '800',
    color: colors.text,
  },
  compareImpactChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.goldLight,
  },
  compareImpactChipText: {
    color: colors.gold,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  compareColumnWrap: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  compareColumn: {
    flex: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    backgroundColor: '#F8F6F1',
    borderWidth: 1,
    borderColor: colors.border,
  },
  compareColumnMember: {
    backgroundColor: '#FFF7EA',
    borderColor: 'rgba(184,138,72,0.2)',
  },
  compareColumnEyebrow: {
    color: colors.textLight,
    fontSize: fontSize.xs,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  compareColumnEyebrowMember: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  compareFreeTitle: {
    color: colors.inkSoft,
    fontSize: fontSize.sm,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  compareMemberTitle: {
    color: colors.primaryDark,
    fontSize: fontSize.sm,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  compareDetail: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    lineHeight: 17,
  },
  compareMemberDetail: {
    color: colors.inkSoft,
    fontSize: fontSize.xs,
    lineHeight: 17,
  },
  compareImpactText: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    lineHeight: 17,
  },
})
