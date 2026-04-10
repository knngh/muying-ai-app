import React, { useState, useCallback, useEffect } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import {
  Text,
  Card,
  Button,
  Avatar,
  Chip,
  Divider,
  TextInput,
  ActivityIndicator,
} from 'react-native-paper'
import LinearGradient from 'react-native-linear-gradient'
import { useRoute, RouteProp } from '@react-navigation/native'
import { communityApi } from '../api/community'
import { ScreenContainer } from '../components/layout'
import { useAppStore } from '../stores/appStore'
import { logError } from '../utils/logger'
import { getSafeRemoteImageSource } from '../utils/security'
import { borderRadius, colors, fontSize, spacing } from '../theme'

type PostDetailRouteProp = RouteProp<{ PostDetail: { id: number } }, 'PostDetail'>

interface Author {
  id: number | string
  nickname?: string
  username?: string
  avatar?: string
  isVerifiedMember?: boolean
}

interface Post {
  id: number
  title: string
  content: string
  category?: string
  author?: Author
  createdAt: string
  likeCount: number
  commentCount: number
  viewCount: number
  isLiked?: boolean
  isPinned?: boolean
}

interface Comment {
  id: number
  content: string
  author?: Author
  createdAt: string
}

function formatTimeLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value || '刚刚'

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <View style={styles.centerState}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  )
}

const PostDetailScreen: React.FC = () => {
  const route = useRoute<PostDetailRouteProp>()
  const { id } = route.params
  const isLoggedIn = useAppStore((state) => Boolean(state.token))

  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchPost = useCallback(async () => {
    try {
      setLoading(true)
      const res = await communityApi.getPostById(id)
      setPost(res as Post)
    } catch (err) {
      logError('PostDetailScreen.fetchPost', err)
    } finally {
      setLoading(false)
    }
  }, [id])

  const fetchComments = useCallback(async () => {
    try {
      const res = await communityApi.getComments(id)
      setComments(res?.list ?? [])
    } catch (err) {
      logError('PostDetailScreen.fetchComments', err)
    }
  }, [id])

  useEffect(() => {
    fetchPost()
    fetchComments()
  }, [fetchPost, fetchComments])

  const handleLikeToggle = useCallback(async () => {
    if (!post) return
    if (!isLoggedIn) {
      Alert.alert('提示', '请先登录后再点赞')
      return
    }
    try {
      if (post.isLiked) {
        await communityApi.unlikePost(post.id)
      } else {
        await communityApi.likePost(post.id)
      }
      setPost((prev) =>
        prev
          ? {
              ...prev,
              isLiked: !prev.isLiked,
              likeCount: prev.isLiked ? prev.likeCount - 1 : prev.likeCount + 1,
            }
          : prev,
      )
    } catch (err) {
      logError('PostDetailScreen.handleLikeToggle', err)
      Alert.alert('错误', '操作失败，请稍后重试')
    }
  }, [isLoggedIn, post])

  const handleSubmitComment = useCallback(async () => {
    if (!isLoggedIn) {
      Alert.alert('提示', '请先登录后再评论')
      return
    }
    if (!commentText.trim()) {
      Alert.alert('提示', '请输入评论内容')
      return
    }
    try {
      setSubmitting(true)
      await communityApi.createComment(id, { content: commentText.trim() })
      setCommentText('')
      fetchComments()
      setPost((prev) => (prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev))
    } catch (err) {
      logError('PostDetailScreen.handleSubmitComment', err)
      Alert.alert('错误', '评论失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }, [commentText, fetchComments, id, isLoggedIn])

  if (loading) {
    return (
      <ScreenContainer style={styles.flex}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    )
  }

  if (!post) {
    return (
      <ScreenContainer style={styles.flex}>
        <EmptyBlock text="帖子不存在或已被删除" />
      </ScreenContainer>
    )
  }

  const authorAvatarSource = getSafeRemoteImageSource(post.author?.avatar)

  return (
    <ScreenContainer style={styles.flex}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Card style={styles.postCard}>
            <LinearGradient
              colors={['#F8E3D6', '#EECBB7', '#F8F1E9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroGradient}
            >
              <View style={styles.heroGlow} />
              <View style={styles.heroRing} />
              <Card.Content>
                <View style={styles.topChipRow}>
                  <Chip compact style={styles.topicChip} textStyle={styles.topicChipText}>
                    社区交流
                  </Chip>
                  {post.category ? (
                    <Chip compact style={styles.categoryChip} textStyle={styles.categoryChipText}>
                      {post.category}
                    </Chip>
                  ) : null}
                  {post.isPinned ? (
                    <Chip compact style={styles.pinnedChip} textStyle={styles.pinnedChipText}>
                      置顶内容
                    </Chip>
                  ) : null}
                </View>

                <View style={styles.authorRow}>
                  {authorAvatarSource ? (
                    <Avatar.Image size={46} source={authorAvatarSource} />
                  ) : (
                    <Avatar.Icon size={46} icon="account" style={styles.avatarIcon} />
                  )}
                  <View style={styles.authorInfo}>
                    <View style={styles.authorNameRow}>
                      <Text style={styles.authorName}>{post.author?.nickname ?? '匿名用户'}</Text>
                      {post.author?.isVerifiedMember ? (
                        <Chip compact style={styles.verifiedChip} textStyle={styles.verifiedChipText}>
                          已验证妈妈
                        </Chip>
                      ) : null}
                    </View>
                    <Text style={styles.postDate}>{formatTimeLabel(post.createdAt)}</Text>
                  </View>
                </View>

                <Text style={styles.postTitle}>{post.title}</Text>
                <Text style={styles.postContent}>{post.content}</Text>

                <View style={styles.statsPanel}>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{post.likeCount}</Text>
                    <Text style={styles.statLabel}>点赞</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{post.commentCount}</Text>
                    <Text style={styles.statLabel}>评论</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{post.viewCount}</Text>
                    <Text style={styles.statLabel}>阅读</Text>
                  </View>
                </View>

                <View style={styles.actionRow}>
                  <Button
                    mode={post.isLiked ? 'contained' : 'outlined'}
                    icon={post.isLiked ? 'heart' : 'heart-outline'}
                    buttonColor={post.isLiked ? colors.primary : undefined}
                    textColor={post.isLiked ? colors.white : colors.primaryDark}
                    style={styles.actionButton}
                    onPress={handleLikeToggle}
                  >
                    {post.isLiked ? '已点赞' : '点赞支持'}
                  </Button>
                  <Chip compact style={styles.actionHintChip} textStyle={styles.actionHintChipText}>
                    评论会按时间顺序显示
                  </Chip>
                </View>
              </Card.Content>
            </LinearGradient>
          </Card>

          <Card style={styles.commentSection}>
            <Card.Content>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionEyebrow}>评论区</Text>
                  <Text style={styles.sectionTitle}>大家的补充与交流</Text>
                </View>
                <Chip compact style={styles.countChip} textStyle={styles.countChipText}>
                  {post.commentCount} 条
                </Chip>
              </View>

              <View style={styles.commentInputShell}>
                <Text style={styles.commentHint}>
                  交流经验时尽量写清具体情况，避免替代专业医疗判断。
                </Text>
                <View style={styles.commentInputRow}>
                  <TextInput
                    placeholder="写下你的想法或补充经验"
                    value={commentText}
                    onChangeText={setCommentText}
                    mode="outlined"
                    style={styles.commentInput}
                    outlineColor="rgba(184,138,72,0.14)"
                    activeOutlineColor={colors.primary}
                    multiline
                  />
                  <Button
                    mode="contained"
                    onPress={handleSubmitComment}
                    loading={submitting}
                    disabled={submitting}
                    buttonColor={colors.techDark}
                    style={styles.commentSubmitButton}
                  >
                    发送
                  </Button>
                </View>
              </View>

              {comments.length === 0 ? (
                <EmptyBlock text="还没有评论，可以先留下你的经验或问题。" />
              ) : (
                comments.map((comment, index) => {
                  const commentAvatarSource = getSafeRemoteImageSource(comment.author?.avatar)

                  return (
                    <View key={comment.id} style={styles.commentCard}>
                      <View style={styles.commentAuthorRow}>
                        {commentAvatarSource ? (
                          <Avatar.Image size={34} source={commentAvatarSource} />
                        ) : (
                          <Avatar.Icon size={34} icon="account" style={styles.avatarIcon} />
                        )}
                        <View style={styles.commentAuthorInfo}>
                          <View style={styles.commentAuthorNameRow}>
                            <Text style={styles.commentAuthorName}>
                              {comment.author?.nickname ?? '匿名用户'}
                            </Text>
                            {comment.author?.isVerifiedMember ? (
                              <Chip
                                compact
                                style={styles.commentVerifiedChip}
                                textStyle={styles.commentVerifiedChipText}
                              >
                                已验证妈妈
                              </Chip>
                            ) : null}
                          </View>
                          <Text style={styles.commentDate}>{formatTimeLabel(comment.createdAt)}</Text>
                        </View>
                      </View>
                      <Text style={styles.commentContent}>{comment.content}</Text>
                      {index < comments.length - 1 ? <Divider style={styles.commentDivider} /> : null}
                    </View>
                  )
                })
              )}
            </Card.Content>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: 136,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerState: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postCard: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  heroGradient: {
    borderRadius: borderRadius.xl,
  },
  heroGlow: {
    position: 'absolute',
    top: -28,
    right: -18,
    width: 156,
    height: 156,
    borderRadius: 78,
    backgroundColor: 'rgba(255,248,242,0.42)',
  },
  heroRing: {
    position: 'absolute',
    top: 26,
    right: 22,
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.12)',
  },
  topChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  topicChip: {
    backgroundColor: 'rgba(255,253,249,0.9)',
  },
  topicChipText: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  categoryChip: {
    backgroundColor: 'rgba(220,236,238,0.76)',
  },
  categoryChipText: {
    color: colors.techDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  pinnedChip: {
    backgroundColor: 'rgba(196,97,64,0.14)',
  },
  pinnedChipText: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarIcon: {
    backgroundColor: 'rgba(220,236,238,0.9)',
  },
  authorInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  authorName: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  verifiedChip: {
    backgroundColor: 'rgba(255,249,243,0.92)',
  },
  verifiedChipText: {
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: '700',
  },
  postDate: {
    marginTop: 2,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  postTitle: {
    fontSize: fontSize.title,
    lineHeight: 34,
    fontWeight: '700',
    color: colors.ink,
  },
  postContent: {
    marginTop: spacing.md,
    fontSize: fontSize.lg,
    color: colors.inkSoft,
    lineHeight: 28,
  },
  statsPanel: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,250,246,0.84)',
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 34,
    backgroundColor: colors.divider,
  },
  statValue: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  statLabel: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  actionRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionButton: {
    borderRadius: borderRadius.pill,
  },
  actionHintChip: {
    backgroundColor: 'rgba(255,249,243,0.92)',
  },
  actionHintChipText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  commentSection: {
    marginTop: spacing.md,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  sectionEyebrow: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  sectionTitle: {
    marginTop: spacing.xs,
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  countChip: {
    backgroundColor: 'rgba(220,236,238,0.76)',
  },
  countChipText: {
    color: colors.techDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  commentInputShell: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,249,243,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.1)',
  },
  commentHint: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  commentInput: {
    flex: 1,
    backgroundColor: 'rgba(255,252,248,0.98)',
  },
  commentSubmitButton: {
    borderRadius: borderRadius.pill,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: fontSize.md,
    lineHeight: 22,
  },
  commentCard: {
    paddingTop: spacing.sm,
  },
  commentAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentAuthorInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  commentAuthorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  commentAuthorName: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
  },
  commentVerifiedChip: {
    backgroundColor: 'rgba(255,249,243,0.92)',
  },
  commentVerifiedChipText: {
    color: colors.primaryDark,
    fontSize: 9,
    fontWeight: '700',
  },
  commentDate: {
    marginTop: 2,
    fontSize: fontSize.xs,
    color: colors.textLight,
  },
  commentContent: {
    marginTop: spacing.sm,
    marginLeft: 42,
    color: colors.inkSoft,
    fontSize: fontSize.md,
    lineHeight: 22,
  },
  commentDivider: {
    marginTop: spacing.md,
  },
})

export default PostDetailScreen
