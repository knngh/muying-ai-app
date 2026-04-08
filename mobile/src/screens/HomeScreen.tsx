import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Text,
  List,
} from "react-native-paper";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { StackNavigationProp } from "@react-navigation/stack";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { articleApi, calendarApi } from "../api/modules";
import type { Article, CalendarEvent, PregnancyCustomTodo, PregnancyTodoProgress } from "../api/modules";
import type {
  RootStackParamList,
  TabParamList,
} from "../navigation/AppNavigator";
import { useAppStore } from "../stores/appStore";
import { useMembershipStore } from "../stores/membershipStore";
import type { WeeklyReport } from "../stores/membershipStore";
import { colors, fontSize, spacing, categoryColors, eventTypeLabels, borderRadius } from "../theme";
import { getStageSummary } from "../utils/stage";
import { calculatePregnancyWeekFromDueDate } from "../utils";
import {
  ScreenContainer,
  ContentSection,
  StandardCard,
} from "../components/layout";
import pregnancyWeekGuide from "../../../shared/data/pregnancy-week-guide.json";

type HomeNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, "Home">,
  StackNavigationProp<RootStackParamList>
>;

type FeatureEntry = {
  title: string;
  icon: string;
  route: "Chat" | "Knowledge" | "Calendar" | "Membership" | "WeeklyReport";
  type: "tab" | "stack";
};

type PregnancyWeekGuideItem = {
  week: number;
  content?: {
    todo?: Array<{
      type?: string;
      title: string;
      desc: string;
    }>;
  };
};

const featureEntries: FeatureEntry[] = [
  {
    title: "知识库",
    icon: "book-open-page-variant-outline",
    route: "Knowledge",
    type: "tab" as const,
  },
  {
    title: "问题助手",
    icon: "message-question-outline",
    route: "Chat",
    type: "tab" as const,
  },
  {
    title: "孕育日历",
    icon: "calendar-check-outline",
    route: "Calendar",
    type: "stack" as const,
  },
  {
    title: "周度报告",
    icon: "chart-box-outline",
    route: "WeeklyReport",
    type: "stack" as const,
  },
];

const AUTHORITY_KEYWORDS: Record<string, string[]> = {
  preparing: ["备孕", "pregnancy prep", "preconception"],
  pregnant: ["孕期", "pregnancy", "prenatal"],
  postpartum: ["新生儿", "产后", "postpartum", "feeding"],
};

export default function HomeScreen() {
  const navigation = useNavigation<HomeNavProp>();
  const user = useAppStore((state) => state.user);
  const {
    status,
    aiUsedToday,
    aiLimit,
    weeklyCompletionRate,
    checkInStreak,
    weeklyReports,
    ensureFreshQuota,
  } = useMembershipStore();
  const [articles, setArticles] = useState<Article[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [todoStats, setTodoStats] = useState<{ week: number | null; total: number; completed: number }>({
    week: null,
    total: 0,
    completed: 0,
  });
  const [loadingArticles, setLoadingArticles] = useState(false);
  const stage = useMemo(() => getStageSummary(user), [user]);
  const currentPregnancyWeek = useMemo(() => (
    user?.dueDate ? calculatePregnancyWeekFromDueDate(user.dueDate) : null
  ), [user?.dueDate]);
  const currentWeekGuide = useMemo(
    () => (pregnancyWeekGuide as PregnancyWeekGuideItem[]).find((item) => item.week === currentPregnancyWeek) ?? null,
    [currentPregnancyWeek],
  );

  useEffect(() => {
    void loadArticles();
    void loadHomeCalendar();
  }, [stage.kind, user?.dueDate]);

  useFocusEffect(
    React.useCallback(() => {
      ensureFreshQuota();
      void loadHomeCalendar();
    }, [currentWeekGuide, currentPregnancyWeek, ensureFreshQuota]),
  );

  const loadArticles = async () => {
    setLoadingArticles(true);
    try {
      const keywordCandidates = AUTHORITY_KEYWORDS[stage.kind] || [];
      let nextArticles: Article[] = [];

      for (const keyword of [...keywordCandidates, ""]) {
        const response = (await articleApi.getList({
          pageSize: 4,
          contentType: "authority",
          sort: "latest",
          keyword: keyword || undefined,
        })) as { list: Article[] };
        if ((response.list || []).length > 0) {
          nextArticles = response.list || [];
          break;
        }
      }

      setArticles(nextArticles);
    } catch (_error) {
      setArticles([]);
    } finally {
      setLoadingArticles(false);
    }
  };

  const loadHomeCalendar = async () => {
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);

      const [events, customTodos, progress] = await Promise.all([
        calendarApi.getEvents({
          startDate: startDate.toISOString().slice(0, 10),
          endDate: endDate.toISOString().slice(0, 10),
        }) as Promise<CalendarEvent[]>,
        currentPregnancyWeek
          ? calendarApi.getCustomTodos({ week: currentPregnancyWeek }) as Promise<PregnancyCustomTodo[]>
          : Promise.resolve([] as PregnancyCustomTodo[]),
        currentPregnancyWeek
          ? calendarApi.getTodoProgress({ week: currentPregnancyWeek }) as Promise<PregnancyTodoProgress[]>
          : Promise.resolve([] as PregnancyTodoProgress[]),
      ]);

      setUpcomingEvents(events.slice(0, 3));
      const defaultTodoKeys = (currentWeekGuide?.content?.todo || []).map((_, index) => `todo-${index}`);
      const customTodoKeys = customTodos.map((item) => `custom-${item.id}`);
      const validTodoKeys = new Set([...defaultTodoKeys, ...customTodoKeys]);
      setTodoStats({
        week: currentPregnancyWeek,
        total: validTodoKeys.size,
        completed: progress.filter(
          (item) => item.week === currentPregnancyWeek && validTodoKeys.has(item.todoKey),
        ).length,
      });
    } catch (_error) {
      setUpcomingEvents([]);
      setTodoStats({ week: currentPregnancyWeek, total: 0, completed: 0 });
    }
  };

  const remainingAiText =
    status === "active" ? "无限次" : `${Math.max(aiLimit - aiUsedToday, 0)} 次`;
  const weeklyReport = (weeklyReports[0] || {
    id: "fallback",
    title: "个性化周度报告",
    stageLabel: "本周预览",
    createdAt: new Date().toISOString(),
    highlights: ["会员可查看完整的阶段重点与建议。"],
  }) as WeeklyReport;
  const articleCount = articles.length;
  const statusTags = [
    `连续打卡 ${checkInStreak} 天`,
    `本周完成 ${weeklyCompletionRate}%`,
    todoStats.total > 0 && todoStats.week ? `孕${todoStats.week}周待办 ${todoStats.completed}/${todoStats.total}` : null,
    upcomingEvents[0] ? `${eventTypeLabels[upcomingEvents[0].eventType] || "提醒"} · ${upcomingEvents[0].title}` : null,
  ].filter(Boolean) as string[];

  const handleFeaturePress = (entry: FeatureEntry) => {
    if (entry.type === "stack") {
      if (entry.route === "Calendar") {
        navigation.navigate("Calendar");
      } else if (entry.route === "WeeklyReport") {
        navigation.navigate("WeeklyReport");
      } else {
        navigation.navigate("Membership");
      }
      return;
    }
    (navigation as any).navigate("Main", { screen: entry.route });
  };

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ContentSection style={styles.heroSection}>
          <StandardCard style={styles.heroCard} elevation={2}>
            <Card.Content>
              <View style={styles.heroTop}>
                <View style={styles.heroTitleWrap}>
                  <Chip
                    style={styles.statusChip}
                    textStyle={styles.statusChipText}
                    compact
                  >
                    {status === "active" ? "会员已开通" : "免费版"}
                  </Chip>
                  <Text style={styles.heroTitle}>{stage.title}</Text>
                  <Text style={styles.heroSubtitle}>{stage.subtitle}</Text>
                </View>

                <Button
                  mode={status === "active" ? "outlined" : "contained"}
                  buttonColor={status === "active" ? undefined : colors.white}
                  textColor={status === "active" ? colors.white : colors.ink}
                  onPress={() =>
                    navigation.navigate(
                      status === "active" ? "Calendar" : "Membership",
                    )
                  }
                  style={styles.heroActionBtn}
                >
                  {status === "active" ? "查看日历" : "升级会员"}
                </Button>
              </View>

              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{remainingAiText}</Text>
                  <Text style={styles.heroStatLabel}>今日使用</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{checkInStreak}天</Text>
                  <Text style={styles.heroStatLabel}>连续打卡</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>
                    {weeklyCompletionRate}%
                  </Text>
                  <Text style={styles.heroStatLabel}>本周完成</Text>
                </View>
              </View>
            </Card.Content>
          </StandardCard>
        </ContentSection>

        <ContentSection>
          <View style={styles.quickActionsRow}>
            {featureEntries.map((entry: FeatureEntry) => (
              <TouchableOpacity
                key={entry.title}
                style={styles.quickActionItem}
                onPress={() => handleFeaturePress(entry)}
                activeOpacity={0.7}
              >
                <View style={styles.quickActionIconBg}>
                  <MaterialCommunityIcons
                    name={entry.icon}
                    size={28}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.quickActionText}>{entry.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ContentSection>

        <ContentSection>
          <View style={styles.infoGrid}>
            <StandardCard style={styles.infoCard}>
              <Card.Content>
                <Text style={styles.infoLabel}>{stage.focusTitle}</Text>
                <Text style={styles.infoTitle}>{stage.reminder}</Text>
              </Card.Content>
            </StandardCard>

            <StandardCard style={[styles.infoCard, styles.infoCardAccent]}>
              <Card.Content>
                <Text style={styles.infoLabel}>今日建议</Text>
                <Text style={styles.infoTitle}>
                  {status === "active" ? stage.aiTipFull : stage.aiTipPreview}
                </Text>
              </Card.Content>
            </StandardCard>
          </View>
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
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>周度报告预览</Text>
            <Button
              mode="text"
              onPress={() =>
                navigation.navigate(
                  status === "active" ? "WeeklyReport" : "Membership",
                )
              }
              compact
            >
              {status === "active" ? "查看历史" : "升级解锁"}
            </Button>
          </View>
          <StandardCard>
            <Card.Content>
              <View style={styles.reportHeader}>
                <View>
                  <Text style={styles.reportTitle}>{weeklyReport.title}</Text>
                  <Text style={styles.reportMeta}>
                    {weeklyReport.stageLabel}
                  </Text>
                </View>
                <Chip
                  style={styles.reportChip}
                  textStyle={styles.reportChipText}
                  compact
                >
                  {status === "active" ? "会员专属" : "升级解锁"}
                </Chip>
              </View>

              {weeklyReport.highlights.map(
                (highlight: string, index: number) => (
                  <Text key={highlight} style={styles.reportItem}>
                    {index + 1}.{" "}
                    {status === "active" || index === 0
                      ? highlight
                      : "会员可查看完整亮点与建议"}
                  </Text>
                ),
              )}
            </Card.Content>
          </StandardCard>
        </ContentSection>

        <ContentSection>
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
                : colors.primary;

              return (
                <StandardCard
                  key={String(item.id)}
                  onPress={() =>
                    navigation.navigate("KnowledgeDetail", { slug: item.slug })
                  }
                >
                  <List.Item
                    title={item.title}
                    titleStyle={styles.articleTitle}
                    titleNumberOfLines={2}
                    description={item.summary || undefined}
                    descriptionStyle={styles.articleSummary}
                    descriptionNumberOfLines={2}
                    left={() =>
                      item.category ? (
                        <View style={styles.articleCategoryWrapper}>
                          <Chip
                            compact
                            style={[
                              styles.articleChip,
                              { backgroundColor: `${tagColor}18` },
                            ]}
                            textStyle={[
                              styles.articleChipText,
                              { color: tagColor },
                            ]}
                          >
                            {item.category.name}
                          </Chip>
                        </View>
                      ) : null
                    }
                  />
                </StandardCard>
              );
            })
          )}
        </ContentSection>

        {upcomingEvents.length > 0 ? (
          <ContentSection>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>近期提醒</Text>
              <Button mode="text" compact onPress={() => navigation.navigate("Calendar")}>
                查看全部
              </Button>
            </View>
            {upcomingEvents.map((event) => (
              <StandardCard key={`${event.id}-${event.eventDate}`}>
                <Card.Content style={styles.upcomingCardContent}>
                  <View style={styles.upcomingMeta}>
                    <Chip compact style={styles.upcomingChip} textStyle={styles.upcomingChipText}>
                      {eventTypeLabels[event.eventType] || "提醒"}
                    </Chip>
                    <Text style={styles.upcomingDate}>{event.eventDate}</Text>
                  </View>
                  <Text style={styles.upcomingTitle}>{event.title}</Text>
                  {event.description ? (
                    <Text style={styles.upcomingDesc} numberOfLines={2}>{event.description}</Text>
                  ) : null}
                </Card.Content>
              </StandardCard>
            ))}
          </ContentSection>
        ) : null}
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heroSection: {
    paddingTop: spacing.md,
  },
  heroCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.xl,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  heroTitleWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  statusChip: {
    alignSelf: "flex-start",
    backgroundColor: colors.white,
    marginBottom: spacing.xs,
    borderRadius: borderRadius.pill,
  },
  statusChipText: {
    color: colors.primaryDark,
    fontWeight: "700",
    fontSize: fontSize.xs,
  },
  heroTitle: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: "700",
  },
  heroSubtitle: {
    color: colors.inkSoft,
    fontSize: fontSize.sm,
  },
  heroActionBtn: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.pill,
  },
  heroStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  heroStat: {
    alignItems: "center",
    flex: 1,
  },
  heroStatLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  heroStatValue: {
    color: colors.ink,
    fontSize: fontSize.lg,
    fontWeight: "700",
  },
  heroStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  quickActionsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  quickActionItem: {
    alignItems: "center",
    gap: spacing.xs,
  },
  quickActionIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  quickActionText: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: "500",
  },
  infoGrid: {
    flexDirection: "row",
    gap: spacing.md,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  summaryChip: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.pill,
  },
  summaryChipText: {
    color: colors.inkSoft,
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
  infoCard: {
    flex: 1,
    backgroundColor: colors.white,
  },
  infoCardAccent: {
    backgroundColor: colors.greenLight,
  },
  infoLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
  },
  infoTitle: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
    lineHeight: 22,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text,
  },
  sectionMeta: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  reportHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  reportTitle: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.text,
  },
  reportMeta: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  reportChip: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.pill,
  },
  reportChipText: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
  reportItem: {
    fontSize: fontSize.sm,
    color: colors.text,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  loader: {
    marginVertical: spacing.lg,
  },
  articleCategoryWrapper: {
    justifyContent: "center",
    alignItems: "center",
    paddingRight: spacing.sm,
    width: 80,
  },
  articleTitle: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
    lineHeight: 22,
  },
  articleChip: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.pill,
  },
  articleChipText: {
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
  articleSummary: {
    marginTop: 4,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  upcomingCardContent: {
    gap: spacing.xs,
  },
  upcomingMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  upcomingChip: {
    alignSelf: "flex-start",
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.pill,
  },
  upcomingChipText: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
  upcomingDate: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
  },
  upcomingTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  upcomingDesc: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
});
