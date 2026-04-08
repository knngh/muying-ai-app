import React, { useEffect, useCallback } from 'react'
import {
  View,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native'
import {
  Text,
  Searchbar,
  Card,
  Chip,
  ActivityIndicator,
  IconButton,
} from 'react-native-paper'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { RootStackParamList } from '../navigation/AppNavigator'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import { colors, spacing, fontSize, categoryColors, borderRadius } from '../theme'
import type { Article } from '../api/modules'

type KnowledgeNavProp = StackNavigationProp<RootStackParamList>

const stageOptions = [
  { label: '全部阶段', value: null },
  { label: '备孕期', value: '备孕期' },
  { label: '孕早期', value: '孕早期' },
  { label: '孕中期', value: '孕中期' },
  { label: '孕晚期', value: '孕晚期' },
  { label: '0-6月', value: '0-6月' },
  { label: '6-12月', value: '6-12月' },
  { label: '1-3岁', value: '1-3岁' },
]

export default function KnowledgeScreen() {
  const navigation = useNavigation<KnowledgeNavProp>()
  const {
    articles,
    categories,
    tags,
    total,
    page,
    pageSize,
    selectedCategory,
    selectedTag,
    selectedStage,
    keyword,
    loading,
    fetchArticles,
    fetchCategories,
    fetchTags,
    setCategory,
    setTag,
    setStage,
    setKeyword,
    search,
  } = useKnowledgeStore()

  useEffect(() => {
    fetchCategories()
    fetchTags()
    fetchArticles({ reset: true })
  }, [])

  const handleSearch = useCallback(() => {
    if (keyword.trim()) {
      search(keyword.trim())
    } else {
      fetchArticles({ reset: true })
    }
  }, [keyword, search, fetchArticles])

  const handleLoadMore = useCallback(() => {
    if (!loading && articles.length < total) {
      fetchArticles({ page: page + 1 })
    }
  }, [loading, articles.length, total, page, fetchArticles])

  const renderArticleItem = ({ item }: { item: Article }) => {
    const catColor = item.category
      ? categoryColors[item.category.name] || colors.primary
      : colors.primary

    return (
      <Card
        style={styles.articleCard}
        onPress={() => navigation.navigate('KnowledgeDetail', { slug: item.slug })}
      >
        <Card.Content>
          <Text style={styles.articleTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.articleMeta}>
            {item.category && (
              <Chip
                style={[styles.categoryChip, { backgroundColor: catColor + '20' }]}
                textStyle={{ fontSize: fontSize.xs, color: catColor }}
                compact
              >
                {item.category.name}
              </Chip>
            )}
          </View>
          {item.summary ? (
            <Text style={styles.articleSummary} numberOfLines={2}>
              {item.summary}
            </Text>
          ) : null}
          <View style={styles.articleStats}>
            <View style={styles.statItem}>
              <IconButton icon="eye-outline" size={14} iconColor={colors.textSecondary} style={styles.statIcon} />
              <Text style={styles.statText}>{item.viewCount || 0}</Text>
            </View>
            <View style={styles.statItem}>
              <IconButton icon="thumb-up-outline" size={14} iconColor={colors.textSecondary} style={styles.statIcon} />
              <Text style={styles.statText}>{item.likeCount || 0}</Text>
            </View>
            <View style={styles.statItem}>
              <IconButton icon="bookmark-outline" size={14} iconColor={colors.textSecondary} style={styles.statIcon} />
              <Text style={styles.statText}>{item.collectCount || 0}</Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    )
  }

  const renderHeader = () => (
    <View>
      {/* Stage Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.stageScroll}
        contentContainerStyle={styles.stageScrollContent}
      >
        {stageOptions.map((option) => (
          <TouchableOpacity
            key={option.label}
            style={[
              styles.stageButton,
              selectedStage === option.value && styles.stageButtonActive,
            ]}
            onPress={() => setStage(option.value)}
          >
            <Text
              style={[
                styles.stageButtonText,
                selectedStage === option.value && styles.stageButtonTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Category Filter */}
      {categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryScrollContent}
        >
          <Chip
            selected={!selectedCategory}
            onPress={() => setCategory(null)}
            style={styles.filterChip}
            compact
          >
            全部
          </Chip>
          {categories.map((cat) => (
            <Chip
              key={cat.id}
              selected={selectedCategory === cat.slug}
              onPress={() =>
                setCategory(selectedCategory === cat.slug ? null : cat.slug)
              }
              style={styles.filterChip}
              compact
            >
              {cat.name}
            </Chip>
          ))}
        </ScrollView>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tagScroll}
          contentContainerStyle={styles.tagScrollContent}
        >
          {tags.map((tag) => (
            <Chip
              key={tag.id}
              selected={selectedTag === tag.slug}
              onPress={() =>
                setTag(selectedTag === tag.slug ? null : tag.slug)
              }
              style={styles.tagChip}
              textStyle={styles.tagChipText}
              compact
              mode="outlined"
            >
              {tag.name}
            </Chip>
          ))}
        </ScrollView>
      )}
    </View>
  )

  const renderFooter = () => {
    if (!loading) return null
    return (
      <ActivityIndicator
        style={styles.footerLoader}
        color={colors.primary}
        size="small"
      />
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>知识库</Text>
      </View>

      <Searchbar
        placeholder="搜索文章..."
        value={keyword}
        onChangeText={setKeyword}
        onSubmitEditing={handleSearch}
        style={styles.searchbar}
        inputStyle={styles.searchInput}
      />

      <FlatList
        data={articles}
        renderItem={renderArticleItem}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>暂无文章</Text>
            </View>
          ) : null
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.white,
  },
  headerTitle: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.text,
  },
  searchbar: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    elevation: 1,
    backgroundColor: colors.white,
    borderRadius: 8,
  },
  searchInput: {
    fontSize: fontSize.md,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  stageScroll: {
    marginBottom: spacing.sm,
  },
  stageScrollContent: {
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  stageButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stageButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stageButtonText: {
    fontSize: fontSize.sm,
    color: colors.textLight,
  },
  stageButtonTextActive: {
    color: colors.white,
  },
  categoryScroll: {
    marginBottom: spacing.sm,
  },
  categoryScrollContent: {
    gap: spacing.sm,
  },
  filterChip: {
    marginRight: spacing.xs,
    borderRadius: borderRadius.pill,
  },
  tagScroll: {
    marginBottom: spacing.md,
  },
  tagScrollContent: {
    gap: spacing.sm,
  },
  tagChip: {
    marginRight: spacing.xs,
    backgroundColor: colors.white,
    borderRadius: borderRadius.pill,
  },
  tagChipText: {
    fontSize: fontSize.xs,
  },
  articleCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    elevation: 0,
    shadowColor: colors.inkSoft,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
  },
  articleTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  articleMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  categoryChip: {
    height: 24,
  },
  articleSummary: {
    fontSize: fontSize.md,
    color: colors.textLight,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  articleStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    margin: 0,
    width: 20,
    height: 20,
  },
  statText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  footerLoader: {
    marginVertical: spacing.lg,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
})
