import React from 'react'
import { StyleSheet, View } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { Chip, Text } from 'react-native-paper'
import type { Article } from '../../api/modules'
import { StandardCard } from '../layout'
import { Skeleton } from '../common'
import { colors, fontSize, spacing, borderRadius, categoryColors } from '../../theme'
import {
  formatSourceLabel,
  getLocalizedFallbackTitle,
  isGenericForeignTitle,
  normalizePlainText,
} from '../../utils/knowledgeText'

interface ArticleListProps {
  articles: Article[]
  loading: boolean
  readingTopic: string
  onPress: (slug: string) => void
}

function getDisplayTitle(article: Article) {
  if (!isGenericForeignTitle(article.title)) {
    return article.title
  }

  return getLocalizedFallbackTitle({
    topic: article.topic,
    stage: article.stage,
    categoryName: article.category?.name,
  })
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
        <View style={styles.loadingWrap}>
          {[1, 2].map((item) => (
            <View key={item} style={styles.loadingCard}>
              <Skeleton width={84} height={24} borderRadius={borderRadius.pill} />
              <Skeleton width="88%" height={20} borderRadius={14} />
              <Skeleton width="72%" height={16} borderRadius={12} />
              <View style={styles.loadingFooter}>
                <Skeleton width={96} height={14} borderRadius={10} />
                <Skeleton width={64} height={14} borderRadius={10} />
              </View>
            </View>
          ))}
        </View>
      ) : articleCount > 0 ? (
        articles.map((item) => {
          const tagColor = item.category
            ? categoryColors[item.category.name] || colors.primary
            : colors.primary
          const articleChipStyle = [styles.articleChip, { backgroundColor: `${tagColor}18` }]
          const articleChipTextStyle = [styles.articleChipText, { color: tagColor }]
          const sourceText = formatSourceLabel(item.sourceOrg || item.source || item.author || '权威内容')
          const dateText = item.publishedAt
            ? new Date(item.publishedAt).toLocaleDateString('zh-CN')
            : ''
          const displayTitle = getDisplayTitle(item)
          const displaySummary = normalizePlainText(item.summary) || '围绕当前阶段整理出的权威知识要点，可进入详情继续阅读来源与正文。'

          return (
            <StandardCard key={String(item.id)} onPress={() => onPress(item.slug)} style={styles.articleCard}>
              <LinearGradient
                colors={['rgba(255,250,246,0.98)', 'rgba(248,239,231,0.96)', 'rgba(244,248,248,0.94)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.articleShell}
              >
                <View style={styles.articleWash} />
                <View style={styles.articleHeader}>
                  {item.category ? (
                    <Chip
                      compact
                      style={articleChipStyle}
                      textStyle={articleChipTextStyle}
                    >
                      {item.category.name}
                    </Chip>
                  ) : (
                    <Chip compact style={styles.articleChip} textStyle={styles.articleChipText}>
                      内容精选
                    </Chip>
                  )}
                  <View style={styles.readingCta}>
                    <Text style={styles.readingCtaText}>阅读全文</Text>
                    <MaterialCommunityIcons name="arrow-top-right" size={16} color={colors.techDark} />
                  </View>
                </View>

                <Text style={styles.articleTitle} numberOfLines={2}>
                  {displayTitle}
                </Text>

                <Text style={styles.articleSummary} numberOfLines={2}>
                  {displaySummary}
                </Text>

                <View style={styles.footerRow}>
                  <View style={styles.metaBadge}>
                    <MaterialCommunityIcons name="shield-check-outline" size={14} color={colors.techDark} />
                    <View style={styles.metaCopy}>
                      <Text style={styles.metaText} numberOfLines={3}>
                        {sourceText}
                      </Text>
                      {dateText ? (
                        <Text style={styles.metaDateText} numberOfLines={1}>
                          {dateText}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.metaBadge}>
                    <MaterialCommunityIcons name="eye-outline" size={14} color={colors.primaryDark} />
                    <Text style={styles.metaText}>{item.viewCount || 0}</Text>
                  </View>
                </View>
              </LinearGradient>
            </StandardCard>
          )
        })
      ) : (
        <StandardCard style={styles.emptyCard} elevation={1}>
          <View style={styles.emptyIconShell}>
            <MaterialCommunityIcons name="book-sync-outline" size={18} color={colors.techDark} />
          </View>
          <Text style={styles.emptyTitle}>正在整理这一阶段的必读内容</Text>
          <Text style={styles.emptyText}>
            当前先根据你的阶段显示推荐主题，新的权威内容同步后会补入这里。
          </Text>
        </StandardCard>
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
    marginBottom: spacing.xs + 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  sectionMeta: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  loadingWrap: {
    gap: spacing.xs + 2,
  },
  loadingCard: {
    padding: spacing.sm + 4,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,249,243,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.1)',
    gap: spacing.xs + 2,
  },
  loadingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  articleCard: {
    marginBottom: spacing.sm + 2,
  },
  articleShell: {
    padding: spacing.sm + 4,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  articleWash: {
    position: 'absolute',
    top: -24,
    right: -18,
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: 'rgba(220,236,238,0.18)',
  },
  articleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm + 2,
  },
  articleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    lineHeight: 20,
    marginBottom: spacing.xs + 2,
  },
  articleChip: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.pill,
  },
  articleChipText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  articleSummary: {
    fontSize: 11,
    color: colors.inkSoft,
    lineHeight: 17,
  },
  readingCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  readingCtaText: {
    fontSize: fontSize.xs,
    color: colors.techDark,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: spacing.xs + 2,
    marginTop: spacing.sm + 2,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    flexShrink: 1,
  },
  metaCopy: {
    flexShrink: 1,
    gap: 2,
  },
  metaText: {
    flexShrink: 1,
    color: colors.textSecondary,
    fontSize: fontSize.xs,
  },
  metaDateText: {
    color: colors.textLight,
    fontSize: 10,
  },
  emptyCard: {
    padding: spacing.md,
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  emptyIconShell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(220,236,238,0.72)',
  },
  emptyTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.ink,
  },
  emptyText: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },
})
