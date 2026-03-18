import React, { useEffect } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Image,
  Share,
  Dimensions,
} from 'react-native'
import { WebView } from 'react-native-webview'
import { Text, Chip, IconButton, Button, ActivityIndicator } from 'react-native-paper'
import { useRoute } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { RootStackParamList } from '../navigation/AppNavigator'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import { colors, spacing, fontSize, categoryColors } from '../theme'

type DetailRouteProp = RouteProp<RootStackParamList, 'KnowledgeDetail'>

const { width: screenWidth } = Dimensions.get('window')

export default function KnowledgeDetailScreen() {
  const route = useRoute<DetailRouteProp>()
  const { slug } = route.params

  const {
    currentArticle: article,
    loading,
    error,
    fetchArticleDetail,
    likeArticle,
    favoriteArticle,
  } = useKnowledgeStore()

  useEffect(() => {
    fetchArticleDetail(slug)
  }, [slug])

  const handleShare = async () => {
    if (!article) return
    try {
      await Share.share({
        title: article.title,
        message: `${article.title}\n\n${article.summary || ''}`,
      })
    } catch (_e) {
      // ignore
    }
  }

  const handleLike = () => {
    if (article) {
      likeArticle(article.id)
    }
  }

  const handleFavorite = () => {
    if (article) {
      favoriteArticle(article.id)
    }
  }

  if (loading && !article) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  if (error && !article) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!article) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>文章不存在</Text>
        </View>
      </SafeAreaView>
    )
  }

  const catColor = article.category
    ? categoryColors[article.category.name] || colors.primary
    : colors.primary

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Title */}
        <Text style={styles.title}>{article.title}</Text>

        {/* Tags */}
        {article.tags && article.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {article.tags.map((tag) => (
              <Chip
                key={tag.id}
                style={styles.tagChip}
                textStyle={styles.tagChipText}
                compact
                mode="outlined"
              >
                {tag.name}
              </Chip>
            ))}
          </View>
        )}

        {/* Meta Row */}
        <View style={styles.metaRow}>
          {article.author && (
            <Text style={styles.metaText}>{article.author}</Text>
          )}
          {article.publishedAt && (
            <Text style={styles.metaText}>
              {new Date(article.publishedAt).toLocaleDateString('zh-CN')}
            </Text>
          )}
          <View style={styles.metaViewCount}>
            <IconButton icon="eye-outline" size={14} iconColor={colors.textSecondary} style={styles.metaIcon} />
            <Text style={styles.metaText}>{article.viewCount || 0}</Text>
          </View>
          {article.category && (
            <Chip
              style={[styles.categoryChip, { backgroundColor: catColor + '20' }]}
              textStyle={{ fontSize: fontSize.xs, color: catColor }}
              compact
            >
              {article.category.name}
            </Chip>
          )}
        </View>

        {/* Cover Image */}
        {article.coverImage ? (
          <Image
            source={{ uri: article.coverImage }}
            style={styles.coverImage}
            resizeMode="cover"
          />
        ) : null}

        {/* Summary */}
        {article.summary ? (
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryText}>{article.summary}</Text>
          </View>
        ) : null}

        {/* Content */}
        <WebView
          source={{ html: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-size:16px;line-height:1.8;color:#333;padding:0;margin:0}img{max-width:100%;height:auto}</style></head><body>${article.content || ''}</body></html>` }}
          style={{ flex: 1, minHeight: 300 }}
          scrollEnabled={false}
          onMessage={() => {}}
        />
      </ScrollView>

      {/* Action Bar */}
      <View style={styles.actionBar}>
        <Button
          mode="outlined"
          icon="thumb-up-outline"
          onPress={handleLike}
          style={styles.actionButton}
          textColor={colors.pink}
        >
          {article.likeCount || 0}
        </Button>
        <Button
          mode="outlined"
          icon="bookmark-outline"
          onPress={handleFavorite}
          style={styles.actionButton}
          textColor={colors.orange}
        >
          {article.collectCount || 0}
        </Button>
        <Button
          mode="outlined"
          icon="share-variant-outline"
          onPress={handleShare}
          style={styles.actionButton}
          textColor={colors.primary}
        >
          分享
        </Button>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: fontSize.md,
    color: colors.red,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: 'bold',
    color: colors.text,
    lineHeight: 34,
    marginBottom: spacing.md,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tagChip: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  tagChipText: {
    fontSize: fontSize.xs,
    color: colors.primary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  metaText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  metaViewCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaIcon: {
    margin: 0,
    width: 18,
    height: 18,
  },
  categoryChip: {
    height: 24,
  },
  coverImage: {
    width: screenWidth - spacing.md * 2,
    height: (screenWidth - spacing.md * 2) * 0.56,
    borderRadius: 12,
    marginBottom: spacing.md,
  },
  summaryContainer: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryText: {
    fontSize: fontSize.md,
    color: colors.textLight,
    lineHeight: 24,
    fontStyle: 'italic',
  },
  contentText: {
    fontSize: fontSize.lg,
    color: colors.text,
    lineHeight: 28,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    borderRadius: 20,
    borderColor: colors.border,
  },
})
