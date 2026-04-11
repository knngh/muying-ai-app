import React from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Chip, Text } from 'react-native-paper'
import { useNavigation } from '@react-navigation/native'
import type { CompositeNavigationProp } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { RootStackParamList, TabParamList } from '../navigation/AppNavigator'
import { ScreenContainer, ContentSection } from '../components/layout'
import {
  HeroCard,
  QuickActions,
  InfoGrid,
  WeeklyReportPreview,
  ArticleList,
  UpcomingEvents,
  HomeSkeleton,
  type FeatureEntry,
} from '../components/home'
import { useHomeData } from '../hooks/useHomeData'
import { colors, fontSize, spacing, borderRadius } from '../theme'

type HomeNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Home'>,
  StackNavigationProp<RootStackParamList>
>

const featureEntries: FeatureEntry[] = [
  { title: '知识库', subtitle: '权威内容与中文阅读', icon: 'book-open-page-variant-outline', route: 'Knowledge', type: 'tab' },
  { title: '问题助手', subtitle: '母婴常见问题参考', icon: 'message-question-outline', route: 'Chat', type: 'tab' },
  { title: '成长日历', subtitle: '拖拽安排待办提醒', icon: 'calendar-check-outline', route: 'Calendar', type: 'stack' },
  { title: '周度报告', subtitle: '每周阶段重点总结', icon: 'chart-box-outline', route: 'WeeklyReport', type: 'stack' },
]

export default function HomeScreen() {
  const navigation = useNavigation<HomeNavProp>()
  const {
    stage,
    status,
    initialLoading,
    articles,
    upcomingEvents,
    loadingArticles,
    remainingAiText,
    checkInStreak,
    weeklyCompletionRate,
    weeklyReport,
    statusTags,
  } = useHomeData()

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

  if (initialLoading) {
    return (
      <ScreenContainer>
        <HomeSkeleton />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
      >
        <ContentSection style={styles.heroSection}>
          <HeroCard
            stage={stage}
            status={status}
            remainingAiText={remainingAiText}
            checkInStreak={checkInStreak}
            weeklyCompletionRate={weeklyCompletionRate}
            actionLabel={stage.actionLabel}
            onAction={() =>
              navigation.navigate(status === 'active' ? 'Calendar' : 'Membership')
            }
          />
        </ContentSection>

        <ContentSection>
          <QuickActions entries={featureEntries} onPress={handleFeaturePress} />
        </ContentSection>

        <ContentSection>
          <InfoGrid
            focusTitle={stage.focusTitle}
            reminder={stage.reminder}
            todayTip={status === 'active' ? stage.aiTipFull : stage.aiTipPreview}
          />
        </ContentSection>

        {statusTags.length > 0 ? (
          <ContentSection>
            <View style={styles.tagRow}>
              {statusTags.map((tag) => (
                <Chip key={tag} compact style={styles.summaryChip} textStyle={styles.summaryChipText}>
                  {tag}
                </Chip>
              ))}
            </View>
          </ContentSection>
        ) : null}

        <ContentSection>
          <WeeklyReportPreview
            report={weeklyReport}
            status={status}
            onViewMore={() =>
              navigation.navigate(status === 'active' ? 'WeeklyReport' : 'Membership')
            }
          />
        </ContentSection>

        <ContentSection>
          <ArticleList
            articles={articles}
            loading={loadingArticles}
            readingTopic={stage.readingTopic}
            onPress={(slug) => navigation.navigate('KnowledgeDetail', { slug })}
          />
        </ContentSection>

        <ContentSection>
          <UpcomingEvents
            events={upcomingEvents}
            onViewAll={() => navigation.navigate('Calendar')}
          />
        </ContentSection>

      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  heroSection: {
    paddingTop: spacing.md,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  summaryChipText: {
    color: colors.inkSoft,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
})
