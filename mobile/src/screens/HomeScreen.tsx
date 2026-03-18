import React, { useEffect, useState } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
} from 'react-native'
import { Text, Button, Card, Chip, ActivityIndicator } from 'react-native-paper'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { RootStackParamList, TabParamList } from '../navigation/AppNavigator'
import type { CompositeNavigationProp } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import { articleApi, Article } from '../api/modules'
import { colors, spacing, fontSize, categoryColors } from '../theme'

type HomeNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Home'>,
  StackNavigationProp<RootStackParamList>
>

const { width } = Dimensions.get('window')
const cardWidth = (width - spacing.md * 2 - spacing.sm * 2) / 3

const features = [
  { title: 'AI智能问答', icon: '💬', color: colors.primary, lightColor: colors.primaryLight },
  { title: '孕育日历', icon: '📅', color: colors.pink, lightColor: colors.pinkLight },
  { title: '科学指导', icon: '📖', color: colors.green, lightColor: colors.greenLight },
]

const quickEntries = [
  { title: '孕早期', color: colors.pink, lightColor: colors.pinkLight, stage: 'early' },
  { title: '孕中期', color: colors.orange, lightColor: colors.orangeLight, stage: 'mid' },
  { title: '孕晚期', color: colors.purple, lightColor: colors.purpleLight, stage: 'late' },
  { title: '产检日历', color: colors.primary, lightColor: colors.primaryLight, stage: 'calendar' },
]

export default function HomeScreen() {
  const navigation = useNavigation<HomeNavProp>()
  const [articles, setArticles] = useState<Article[]>([])
  const [loadingArticles, setLoadingArticles] = useState(false)

  useEffect(() => {
    loadArticles()
  }, [])

  const loadArticles = async () => {
    setLoadingArticles(true)
    try {
      const response = await articleApi.getList({ pageSize: 5 }) as { list: Article[] }
      setArticles(response.list || [])
    } catch (_e) {
      // ignore
    } finally {
      setLoadingArticles(false)
    }
  }

  const handleFeatureTap = (index: number) => {
    switch (index) {
      case 0:
        navigation.navigate('Main', { screen: 'Chat' } as any)
        break
      case 1:
        navigation.navigate('Calendar')
        break
      case 2:
        navigation.navigate('Main', { screen: 'Knowledge' } as any)
        break
    }
  }

  const handleQuickEntry = (entry: typeof quickEntries[0]) => {
    if (entry.stage === 'calendar') {
      navigation.navigate('Calendar')
    } else {
      navigation.navigate('Main', { screen: 'Knowledge' } as any)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>欢迎使用母婴AI助手</Text>
          <Text style={styles.heroSubtitle}>
            智能问答 · 科学孕育 · 贴心陪伴
          </Text>
          <Button
            mode="contained"
            onPress={() => navigation.navigate('Main', { screen: 'Chat' } as any)}
            style={styles.heroButton}
            buttonColor={colors.primary}
            textColor={colors.white}
          >
            开始咨询
          </Button>
        </View>

        {/* Feature Cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>核心功能</Text>
          <View style={styles.featureRow}>
            {features.map((feature, index) => (
              <Card
                key={feature.title}
                style={[styles.featureCard, { backgroundColor: feature.lightColor }]}
                onPress={() => handleFeatureTap(index)}
              >
                <Card.Content style={styles.featureCardContent}>
                  <Text style={styles.featureIcon}>{feature.icon}</Text>
                  <Text style={[styles.featureTitle, { color: feature.color }]}>
                    {feature.title}
                  </Text>
                </Card.Content>
              </Card>
            ))}
          </View>
        </View>

        {/* Recommended Articles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>推荐阅读</Text>
          {loadingArticles ? (
            <ActivityIndicator style={styles.loader} color={colors.primary} />
          ) : articles.length === 0 ? (
            <Text style={styles.emptyText}>暂无推荐文章</Text>
          ) : (
            articles.map((item) => (
              <TouchableOpacity
                key={String(item.id)}
                style={styles.articleItem}
                onPress={() => navigation.navigate('KnowledgeDetail', { slug: item.slug })}
                activeOpacity={0.7}
              >
                <View style={styles.articleContent}>
                  <Text style={styles.articleTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.category && (
                    <Chip
                      style={[
                        styles.categoryChip,
                        { backgroundColor: (categoryColors[item.category.name] || colors.primary) + '20' },
                      ]}
                      textStyle={{
                        fontSize: fontSize.xs,
                        color: categoryColors[item.category.name] || colors.primary,
                      }}
                      compact
                    >
                      {item.category.name}
                    </Chip>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Quick Entry Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>快速入口</Text>
          <View style={styles.quickGrid}>
            {quickEntries.map((entry) => (
              <TouchableOpacity
                key={entry.title}
                style={[styles.quickCard, { backgroundColor: entry.lightColor }]}
                onPress={() => handleQuickEntry(entry)}
                activeOpacity={0.7}
              >
                <Text style={[styles.quickCardTitle, { color: entry.color }]}>
                  {entry.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  hero: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: fontSize.title,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    fontSize: fontSize.md,
    color: colors.textLight,
    marginBottom: spacing.lg,
  },
  heroButton: {
    borderRadius: 24,
    paddingHorizontal: spacing.lg,
  },
  section: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  featureCard: {
    width: cardWidth,
    borderRadius: 12,
    elevation: 0,
  },
  featureCardContent: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  featureIcon: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  featureTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  articleItem: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  articleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  articleTitle: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
    marginRight: spacing.sm,
  },
  categoryChip: {
    height: 24,
  },
  loader: {
    marginVertical: spacing.lg,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginVertical: spacing.lg,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickCard: {
    width: (width - spacing.md * 2 - spacing.sm) / 2,
    height: 80,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  quickCardTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: spacing.xl,
  },
})
