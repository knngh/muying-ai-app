import React from 'react'
import { StyleSheet, View } from 'react-native'
import { ActivityIndicator, Chip, List, Text } from 'react-native-paper'
import type { Article } from '../../api/modules'
import { StandardCard } from '../layout'
import { colors, fontSize, spacing, borderRadius, categoryColors } from '../../theme'

interface ArticleListProps {
  articles: Article[]
  loading: boolean
  readingTopic: string
  onPress: (slug: string) => void
}

function ArticleListInner({ articles, loading, readingTopic, onPress }: ArticleListProps) {
  const articleCount = articles.length

  return (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>本周必读</Text>
        <Text style={styles.sectionMeta}>
          {articleCount > 0 ? `${articleCount} 篇内容` : readingTopic}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        articles.map((item) => {
          const tagColor = item.category
            ? categoryColors[item.category.name] || colors.primary
            : colors.primary

          return (
            <StandardCard key={String(item.id)} onPress={() => onPress(item.slug)}>
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
                        style={[styles.articleChip, { backgroundColor: `${tagColor}18` }]}
                        textStyle={[styles.articleChipText, { color: tagColor }]}
                      >
                        {item.category.name}
                      </Chip>
                    </View>
                  ) : null
                }
              />
            </StandardCard>
          )
        })
      )}
    </View>
  )
}

const ArticleList = React.memo(ArticleListInner)
export default ArticleList

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  sectionMeta: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  loader: {
    marginVertical: spacing.lg,
  },
  articleCategoryWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: spacing.sm,
    width: 80,
  },
  articleTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 22,
  },
  articleChip: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.pill,
  },
  articleChipText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  articleSummary: {
    marginTop: 4,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 18,
  },
})
