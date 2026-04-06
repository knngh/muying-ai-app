import React, { useEffect, useMemo, useState } from 'react'
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import { ActivityIndicator, Button, Card, Chip, Text } from 'react-native-paper'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { CompositeNavigationProp } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import type { StackNavigationProp } from '@react-navigation/stack'
import { articleApi } from '../api/modules'
import type { Article } from '../api/modules'
import type { RootStackParamList, TabParamList } from '../navigation/AppNavigator'
import { useAppStore } from '../stores/appStore'
import { useMembershipStore } from '../stores/membershipStore'
import type { WeeklyReport } from '../stores/membershipStore'
import { colors, fontSize, spacing, categoryColors } from '../theme'
import { getStageSummary } from '../utils/stage'

type HomeNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Home'>,
  StackNavigationProp<RootStackParamList>
>

type FeatureEntry = {
  title: string
  subtitle: string
  route: 'Chat' | 'Knowledge' | 'Calendar' | 'Membership' | 'WeeklyReport'
  type: 'tab' | 'stack'
}

const featureEntries: FeatureEntry[] = [
  { title: 'AI 问答', subtitle: '无限咨询升级', route: 'Chat', type: 'tab' as const },
  { title: '智能日历', subtitle: '提醒与打卡', route: 'Calendar', type: 'stack' as const },
  { title: '知识库', subtitle: '阶段精准阅读', route: 'Knowledge', type: 'tab' as const },
  { title: 'AI 周报', subtitle: '本周重点回顾', route: 'WeeklyReport', type: 'stack' as const },
]

export default function HomeScreen() {
  const navigation = useNavigation<HomeNavProp>()
  const user = useAppStore(state => state.user)
  const { status, aiUsedToday, aiLimit, weeklyCompletionRate, checkInStreak, weeklyReports, ensureFreshQuota } =
    useMembershipStore()
  const [articles, setArticles] = useState<Article[]>([])
  const [loadingArticles, setLoadingArticles] = useState(false)
  const stage = useMemo(() => getStageSummary(user), [user])

  useEffect(() => {
    loadArticles()
  }, [])

  useFocusEffect(
    React.useCallback(() => {
      ensureFreshQuota()
    }, [ensureFreshQuota]),
  )

  const loadArticles = async () => {
    setLoadingArticles(true)
    try {
      const response = await articleApi.getList({ pageSize: 4 }) as { list: Article[] }
      setArticles(response.list || [])
    } catch (_error) {
      setArticles([])
    } finally {
      setLoadingArticles(false)
    }
  }

  const remainingAiText = status === 'active' ? '无限次' : `${Math.max(aiLimit - aiUsedToday, 0)} 次`
  const weeklyReport = (weeklyReports[0] || {
    id: 'fallback',
    title: 'AI 个性化周报',
    stageLabel: '本周预览',
    createdAt: new Date().toISOString(),
    highlights: ['会员可查看完整的阶段重点与建议。'],
  }) as WeeklyReport
  const articleCount = articles.length

  const handleFeaturePress = (entry: FeatureEntry) => {
    if (entry.type === 'stack') {
      if (entry.route === 'Calendar') {
        navigation.navigate('Calendar')
      } else if (entry.route === 'WeeklyReport') {
        navigation.navigate('WeeklyReport')
      } else {
        navigation.navigate('Membership')
      }
      return
    }
    ;(navigation as any).navigate('Main', { screen: entry.route })
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.heroCard}>
          <Card.Content>
            <View style={styles.heroTop}>
              <View style={styles.heroTitleWrap}>
                <Chip style={styles.statusChip} textStyle={styles.statusChipText}>
                  {status === 'active' ? '会员已开通' : '免费版'}
                </Chip>
                <Text style={styles.heroTitle}>{stage.title}</Text>
                <Text style={styles.heroSubtitle}>{stage.subtitle}</Text>
              </View>

              <Button
                mode={status === 'active' ? 'outlined' : 'contained'}
                buttonColor={status === 'active' ? undefined : colors.white}
                textColor={status === 'active' ? colors.white : colors.ink}
                onPress={() => navigation.navigate(status === 'active' ? 'Calendar' : 'Membership')}
              >
                {status === 'active' ? '查看日历' : '升级会员'}
              </Button>
            </View>

            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>今日 AI 剩余</Text>
                <Text style={styles.heroStatValue}>{remainingAiText}</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>连续打卡</Text>
                <Text style={styles.heroStatValue}>{checkInStreak} 天</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>本周完成率</Text>
                <Text style={styles.heroStatValue}>{weeklyCompletionRate}%</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        <View style={styles.infoGrid}>
          <Card style={styles.infoCard}>
            <Card.Content>
              <Text style={styles.infoLabel}>{stage.focusTitle}</Text>
              <Text style={styles.infoTitle}>{stage.reminder}</Text>
              <Text style={styles.infoMeta}>根据阶段自动整理，适合今天先做的一件事。</Text>
            </Card.Content>
          </Card>

          <Card style={[styles.infoCard, styles.infoCardAccent]}>
            <Card.Content>
              <Text style={styles.infoLabel}>AI 今日建议</Text>
              <Text style={styles.infoTitle}>
                {status === 'active' ? stage.aiTipFull : stage.aiTipPreview}
              </Text>
              <Text style={styles.infoMeta}>
                {status === 'active' ? '会员可查看完整版建议。' : '升级后可解锁完整建议和多轮追问。'}
              </Text>
            </Card.Content>
          </Card>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>快捷入口</Text>
            <Text style={styles.sectionMeta}>围绕转化优先重组</Text>
          </View>

          <View style={styles.featureGrid}>
            {featureEntries.map((entry: FeatureEntry) => (
              <TouchableOpacity
                key={entry.title}
                style={styles.featureCard}
                onPress={() => handleFeaturePress(entry)}
                activeOpacity={0.82}
              >
                <Text style={styles.featureTitle}>{entry.title}</Text>
                <Text style={styles.featureSubtitle}>{entry.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>AI 周报预览</Text>
            <Button mode="text" onPress={() => navigation.navigate(status === 'active' ? 'WeeklyReport' : 'Membership')}>
              {status === 'active' ? '查看历史' : '升级解锁'}
            </Button>
          </View>
          <Card style={styles.reportCard}>
            <Card.Content>
              <View style={styles.reportHeader}>
                <View>
                  <Text style={styles.reportTitle}>{weeklyReport.title}</Text>
                  <Text style={styles.reportMeta}>{weeklyReport.stageLabel}</Text>
                </View>
                <Chip style={styles.reportChip} textStyle={styles.reportChipText}>
                  {status === 'active' ? '会员专属' : '升级可解锁'}
                </Chip>
              </View>

              {weeklyReport.highlights.map((highlight: string, index: number) => (
                <Text key={highlight} style={styles.reportItem}>
                  {index + 1}. {status === 'active' || index === 0 ? highlight : '会员可查看完整亮点与建议'}
                </Text>
              ))}
            </Card.Content>
          </Card>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>本周必读</Text>
            <Text style={styles.sectionMeta}>
              {articleCount > 0 ? `${articleCount} 篇内容` : stage.readingTopic}
            </Text>
          </View>

          {loadingArticles ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : (
            articles.map((item: Article) => {
              const tagColor = item.category
                ? categoryColors[item.category.name] || colors.primary
                : colors.primary

              return (
                <TouchableOpacity
                  key={String(item.id)}
                  style={styles.articleCard}
                  onPress={() => navigation.navigate('KnowledgeDetail', { slug: item.slug })}
                  activeOpacity={0.8}
                >
                  <View style={styles.articleTop}>
                    <Text style={styles.articleTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    {item.category ? (
                      <Chip
                        compact
                        style={[styles.articleChip, { backgroundColor: `${tagColor}18` }]}
                        textStyle={[styles.articleChipText, { color: tagColor }]}
                      >
                        {item.category.name}
                      </Chip>
                    ) : null}
                  </View>
                  {item.summary ? (
                    <Text style={styles.articleSummary} numberOfLines={2}>
                      {item.summary}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              )
            })
          )}
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
    borderRadius: 28,
    backgroundColor: colors.ink,
  },
  heroTop: {
    gap: spacing.md,
  },
  heroTitleWrap: {
    gap: spacing.sm,
  },
  statusChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,247,219,0.16)',
  },
  statusChipText: {
    color: colors.gold,
    fontWeight: '700',
  },
  heroTitle: {
    color: colors.white,
    fontSize: 30,
    fontWeight: '700',
  },
  heroSubtitle: {
    color: '#d7e0f7',
    fontSize: fontSize.md,
    lineHeight: 22,
  },
  heroStats: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  heroStat: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroStatLabel: {
    color: '#aab7db',
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
  },
  heroStatValue: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  infoGrid: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  infoCard: {
    borderRadius: 20,
    backgroundColor: colors.white,
  },
  infoCardAccent: {
    backgroundColor: colors.goldLight,
  },
  infoLabel: {
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  infoTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 26,
  },
  infoMeta: {
    marginTop: spacing.sm,
    color: colors.textLight,
    lineHeight: 20,
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionHeader: {
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
  },
  sectionMeta: {
    color: colors.textSecondary,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  featureCard: {
    width: '47%',
    minHeight: 108,
    borderRadius: 22,
    padding: spacing.md,
    backgroundColor: colors.white,
    justifyContent: 'space-between',
  },
  featureTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.ink,
  },
  featureSubtitle: {
    color: colors.textLight,
    lineHeight: 20,
  },
  reportCard: {
    borderRadius: 20,
    backgroundColor: colors.white,
  },
  reportHeader: {
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  reportTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  reportMeta: {
    marginTop: spacing.xs,
    color: colors.textLight,
  },
  reportChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
  },
  reportChipText: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  reportItem: {
    marginBottom: spacing.sm,
    color: colors.text,
    lineHeight: 22,
  },
  loader: {
    marginVertical: spacing.lg,
  },
  articleCard: {
    marginBottom: spacing.md,
    borderRadius: 20,
    padding: spacing.md,
    backgroundColor: colors.white,
  },
  articleTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  articleTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  articleChip: {
    backgroundColor: colors.primaryLight,
  },
  articleChipText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  articleSummary: {
    marginTop: spacing.sm,
    color: colors.textLight,
    lineHeight: 20,
  },
})
