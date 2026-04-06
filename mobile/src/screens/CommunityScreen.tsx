import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, FlatList, SafeAreaView, StyleSheet, TouchableOpacity, View } from 'react-native'
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  Chip,
  IconButton,
  Modal,
  Portal,
  Searchbar,
  Text,
  TextInput,
} from 'react-native-paper'
import { useNavigation } from '@react-navigation/native'
import { communityApi, type CommunityPost } from '../api/community'
import { useAppStore } from '../stores/appStore'
import { colors, fontSize, spacing } from '../theme'
import { logError } from '../utils/logger'
import { getSafeRemoteImageSource } from '../utils/security'
import {
  COMMUNITY_STAGE_LABELS,
  COMMUNITY_STAGE_OPTIONS,
  getStageSummary,
  resolveCommunityStageFromPost,
  type CommunityStageKey,
} from '../utils/stage'

const SORT_OPTIONS = [
  { key: 'latest', label: '最新' },
  { key: 'hot', label: '最热' },
  { key: 'popular', label: '最受欢迎' },
] as const

type SortKey = typeof SORT_OPTIONS[number]['key']
type StageFilter = CommunityStageKey

export default function CommunityScreen() {
  const navigation = useNavigation<any>()
  const user = useAppStore(state => state.user)
  const isLoggedIn = useAppStore(state => Boolean(state.token))
  const stage = useMemo(() => getStageSummary(user), [user])
  const defaultStageFilter = user ? stage.communityStage : 'all'

  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('latest')
  const [stageFilter, setStageFilter] = useState<StageFilter>(defaultStageFilter)
  const [modalVisible, setModalVisible] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')

  const loadingMore = useRef(false)

  useEffect(() => {
    setStageFilter(defaultStageFilter)
  }, [defaultStageFilter])

  const fetchPosts = useCallback(async (pageNum: number, refresh = false) => {
    if (loading && !refresh) return

    try {
      if (refresh) setRefreshing(true)
      else setLoading(true)

      const params: { page: number; sort: SortKey; keyword?: string } = { page: pageNum, sort: sortBy }
      if (searchQuery.trim()) {
        params.keyword = searchQuery.trim()
      }

      const res = await communityApi.getPosts(params)
      const nextPosts = res?.list ?? []

      if (refresh || pageNum === 1) {
        setPosts(nextPosts)
      } else {
        setPosts((prev) => [...prev, ...nextPosts])
      }

      setHasMore(nextPosts.length >= 10)
      setPage(pageNum)
    } catch (error) {
      logError('CommunityScreen.fetchPosts', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
      loadingMore.current = false
    }
  }, [loading, searchQuery, sortBy])

  useEffect(() => {
    fetchPosts(1, true)
  }, [fetchPosts, sortBy])

  const handleSearch = useCallback(() => {
    fetchPosts(1, true)
  }, [fetchPosts])

  const handleRefresh = useCallback(() => {
    fetchPosts(1, true)
  }, [fetchPosts])

  const handleLoadMore = useCallback(() => {
    if (!hasMore || loadingMore.current) return
    loadingMore.current = true
    fetchPosts(page + 1)
  }, [fetchPosts, hasMore, page])

  const handleLikeToggle = useCallback(async (post: CommunityPost) => {
    if (!isLoggedIn) {
      Alert.alert('提示', '请先登录后再点赞')
      return
    }

    try {
      if (post.isLiked) {
        await communityApi.unlikePost(Number(post.id))
      } else {
        await communityApi.likePost(Number(post.id))
      }

      setPosts((prev) =>
        prev.map((item) => (
          item.id === post.id
            ? {
              ...item,
              isLiked: !item.isLiked,
              likeCount: item.isLiked ? item.likeCount - 1 : item.likeCount + 1,
            }
            : item
        )),
      )
    } catch (error) {
      logError('CommunityScreen.handleLikeToggle', error)
      Alert.alert('错误', '操作失败，请稍后重试')
    }
  }, [isLoggedIn])

  const closeComposer = useCallback(() => {
    setModalVisible(false)
    setFormTitle('')
    setFormContent('')
  }, [])

  const checkLoginAndOpenModal = useCallback(async () => {
    if (!isLoggedIn) {
      Alert.alert('提示', '请先登录后再发帖')
      return
    }

    setFormTitle('')
    setFormContent('')
    setModalVisible(true)
  }, [isLoggedIn])

  const handleSubmitPost = useCallback(async () => {
    if (!formTitle.trim()) {
      Alert.alert('提示', '请输入帖子标题')
      return
    }

    if (!formContent.trim()) {
      Alert.alert('提示', '请输入帖子内容')
      return
    }

    try {
      await communityApi.createPost({
        title: formTitle.trim(),
        content: formContent.trim(),
      })
      closeComposer()
      fetchPosts(1, true)
    } catch (_error) {
      Alert.alert('错误', '发帖失败，请稍后重试')
    }
  }, [closeComposer, fetchPosts, formContent, formTitle])

  const filteredPosts = useMemo(() => {
    if (stageFilter === 'all') {
      return posts
    }

    return posts.filter((post) => resolveCommunityStageFromPost(post) === stageFilter)
  }, [posts, stageFilter])

  const renderPostItem = useCallback(({ item }: { item: CommunityPost }) => {
    const authorAvatarSource = getSafeRemoteImageSource(item.author?.avatar)

    return (
      <TouchableOpacity activeOpacity={0.76} onPress={() => navigation.navigate('PostDetail', { id: item.id })}>
        <Card style={styles.postCard}>
          <Card.Content>
            <View style={styles.authorRow}>
              {authorAvatarSource ? (
                <Avatar.Image size={36} source={authorAvatarSource} />
              ) : (
                <Avatar.Icon size={36} icon="account" style={styles.avatarIcon} />
              )}
              <View style={styles.authorInfo}>
                <View style={styles.authorNameRow}>
                  <Text style={styles.authorName}>{item.author?.nickname ?? item.author?.username ?? '匿名用户'}</Text>
                  {item.author?.isVerifiedMember ? (
                    <Chip compact style={styles.memberChip} textStyle={styles.memberChipText}>
                      已验证妈妈
                    </Chip>
                  ) : null}
                </View>
                <Text style={styles.postDate}>{item.createdAt}</Text>
              </View>
            </View>

            <View style={styles.titleRow}>
              {item.isPinned ? (
                <Chip compact style={styles.pinnedChip} textStyle={styles.pinnedChipText}>
                  置顶
                </Chip>
              ) : null}
              <Text style={styles.postTitle} numberOfLines={1}>
                {item.title}
              </Text>
            </View>

            <Text style={styles.postContent} numberOfLines={2}>
              {item.content}
            </Text>

            <View style={styles.metaRow}>
              <Chip compact style={styles.stageChip} textStyle={styles.stageChipText}>
                {COMMUNITY_STAGE_LABELS[resolveCommunityStageFromPost(item)]}
              </Chip>
              {item.categoryName ? (
                <Text style={styles.categoryText}>{item.categoryName}</Text>
              ) : null}
            </View>

            <View style={styles.statsRow}>
              <TouchableOpacity style={styles.statItem} onPress={() => handleLikeToggle(item)}>
                <IconButton
                  icon={item.isLiked ? 'heart' : 'heart-outline'}
                  size={16}
                  iconColor={item.isLiked ? colors.red : colors.textSecondary}
                  style={styles.statIcon}
                />
                <Text style={styles.statText}>{item.likeCount}</Text>
              </TouchableOpacity>
              <View style={styles.statItem}>
                <IconButton icon="comment-outline" size={16} iconColor={colors.textSecondary} style={styles.statIcon} />
                <Text style={styles.statText}>{item.commentCount}</Text>
              </View>
              <View style={styles.statItem}>
                <IconButton icon="eye-outline" size={16} iconColor={colors.textSecondary} style={styles.statIcon} />
                <Text style={styles.statText}>{item.viewCount}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      </TouchableOpacity>
    )
  }, [handleLikeToggle, navigation])

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>社区交流</Text>
          <Text style={styles.headerSubtitle}>
            {user
              ? `当前阶段：${stage.title}，默认圈子：${stage.communityStageLabel}。`
              : '登录后会默认优先展示同阶段圈子内容。'}
          </Text>
        </View>
        <Button mode="contained" icon="pencil" onPress={checkLoginAndOpenModal} buttonColor={colors.ink}>
          发帖
        </Button>
      </View>

      <Searchbar
        placeholder="搜索帖子"
        onChangeText={setSearchQuery}
        value={searchQuery}
        onSubmitEditing={handleSearch}
        style={styles.searchBar}
      />

      <View style={styles.stageRow}>
        {COMMUNITY_STAGE_OPTIONS.map((option) => (
          <Chip
            key={option.key}
            selected={stageFilter === option.key}
            onPress={() => setStageFilter(option.key)}
            style={[styles.filterChip, stageFilter === option.key && styles.filterChipSelected]}
            textStyle={stageFilter === option.key ? styles.filterChipTextSelected : styles.filterChipText}
          >
            {option.label}
          </Chip>
        ))}
      </View>

      <View style={styles.sortRow}>
        {SORT_OPTIONS.map((option) => (
          <Chip
            key={option.key}
            selected={sortBy === option.key}
            onPress={() => setSortBy(option.key)}
            style={[styles.sortChip, sortBy === option.key && styles.sortChipSelected]}
            textStyle={sortBy === option.key ? styles.sortChipTextSelected : styles.sortChipText}
          >
            {option.label}
          </Chip>
        ))}
      </View>

      <FlatList
        data={filteredPosts}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderPostItem}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={!loading ? (
          <Text style={styles.emptyText}>
            {stageFilter === 'all' ? '暂无帖子' : `当前没有${COMMUNITY_STAGE_LABELS[stageFilter]}内容`}
          </Text>
        ) : null}
        ListFooterComponent={loading && posts.length > 0 ? (
          <ActivityIndicator style={styles.footerLoader} color={colors.primary} />
        ) : null}
      />

      <Portal>
        <Modal visible={modalVisible} onDismiss={closeComposer} contentContainerStyle={styles.modalContainer}>
          <Text style={styles.modalTitle}>发布新帖</Text>
          <Text style={styles.modalSubtitle}>围绕你当前阶段的真实问题发帖，更容易获得有效回复。</Text>
          <View style={styles.modalGuideCard}>
            <Text style={styles.modalGuideLabel}>当前推荐圈子</Text>
            <Text style={styles.modalGuideValue}>{user ? stage.communityStageLabel : '全部圈子'}</Text>
            <Text style={styles.modalGuideHint}>标题或正文里写清阶段信息，更容易获得同阶段妈妈的经验回复。</Text>
          </View>

          <TextInput
            label="标题"
            value={formTitle}
            onChangeText={setFormTitle}
            mode="outlined"
            style={styles.input}
            activeOutlineColor={colors.primary}
          />

          <TextInput
            label="内容"
            value={formContent}
            onChangeText={setFormContent}
            mode="outlined"
            multiline
            numberOfLines={4}
            style={styles.input}
            activeOutlineColor={colors.primary}
          />

          <Button mode="contained" buttonColor={colors.ink} onPress={handleSubmitPost} style={styles.submitButton}>
            发布
          </Button>
          <Button mode="text" onPress={closeComposer}>
            取消
          </Button>
        </Modal>
      </Portal>
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    marginTop: spacing.xs,
    color: colors.textLight,
  },
  searchBar: {
    marginTop: spacing.md,
    marginHorizontal: spacing.md,
    borderRadius: 18,
    backgroundColor: colors.white,
  },
  stageRow: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterChip: {
    backgroundColor: colors.white,
  },
  filterChipSelected: {
    backgroundColor: colors.ink,
  },
  filterChipText: {
    color: colors.text,
  },
  filterChipTextSelected: {
    color: colors.white,
  },
  sortRow: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sortChip: {
    backgroundColor: colors.white,
  },
  sortChipSelected: {
    backgroundColor: colors.primaryLight,
  },
  sortChipText: {
    color: colors.text,
  },
  sortChipTextSelected: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  postCard: {
    marginBottom: spacing.md,
    borderRadius: 22,
    backgroundColor: colors.white,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatarIcon: {
    backgroundColor: colors.primaryLight,
  },
  authorInfo: {
    flex: 1,
  },
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  authorName: {
    fontWeight: '700',
    color: colors.text,
  },
  memberChip: {
    backgroundColor: colors.goldLight,
  },
  memberChipText: {
    color: colors.gold,
    fontWeight: '700',
  },
  postDate: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  titleRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pinnedChip: {
    backgroundColor: colors.redLight,
  },
  pinnedChipText: {
    color: colors.red,
    fontWeight: '700',
  },
  postTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  postContent: {
    marginTop: spacing.sm,
    color: colors.textLight,
    lineHeight: 22,
  },
  metaRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stageChip: {
    backgroundColor: colors.primaryLight,
  },
  stageChipText: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  categoryText: {
    color: colors.textSecondary,
  },
  statsRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    gap: spacing.md,
  },
  statItem: {
    marginLeft: -6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    margin: 0,
  },
  statText: {
    color: colors.textSecondary,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: spacing.xl,
  },
  footerLoader: {
    marginTop: spacing.md,
  },
  modalContainer: {
    margin: spacing.md,
    borderRadius: 24,
    padding: spacing.lg,
    backgroundColor: colors.white,
  },
  modalTitle: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text,
  },
  modalSubtitle: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    color: colors.textLight,
  },
  modalGuideCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
  },
  modalGuideLabel: {
    color: colors.primaryDark,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  modalGuideValue: {
    marginTop: spacing.xs,
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  modalGuideHint: {
    marginTop: spacing.xs,
    color: colors.textLight,
    lineHeight: 20,
  },
  input: {
    marginBottom: spacing.md,
    backgroundColor: colors.white,
  },
  submitButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
})
