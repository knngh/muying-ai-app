import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  Avatar,
  IconButton,
  Chip,
  Divider,
  TextInput,
  ActivityIndicator,
} from 'react-native-paper';
import { useRoute, RouteProp } from '@react-navigation/native';
import { communityApi } from '../api/community';
import { useAppStore } from '../stores/appStore';
import { logError } from '../utils/logger';
import { getSafeRemoteImageSource } from '../utils/security';

const THEME_PRIMARY = '#1890ff';

type PostDetailRouteProp = RouteProp<{ PostDetail: { id: number } }, 'PostDetail'>;

interface Author {
  id: number | string;
  nickname?: string;
  username?: string;
  avatar?: string;
  isVerifiedMember?: boolean;
}

interface Post {
  id: number;
  title: string;
  content: string;
  category?: string;
  author?: Author;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  isLiked?: boolean;
  isPinned?: boolean;
}

interface Comment {
  id: number;
  content: string;
  author?: Author;
  createdAt: string;
}

const PostDetailScreen: React.FC = () => {
  const route = useRoute<PostDetailRouteProp>();
  const { id } = route.params;
  const isLoggedIn = useAppStore((state) => Boolean(state.token));

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchPost = useCallback(async () => {
    try {
      setLoading(true);
      const res = await communityApi.getPostById(id);
      setPost(res as any);
    } catch (err) {
      logError('PostDetailScreen.fetchPost', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchComments = useCallback(async () => {
    try {
      const res = await communityApi.getComments(id);
      setComments(res?.list ?? []);
    } catch (err) {
      logError('PostDetailScreen.fetchComments', err);
    }
  }, [id]);

  useEffect(() => {
    fetchPost();
    fetchComments();
  }, [fetchPost, fetchComments]);

  const handleLikeToggle = useCallback(async () => {
    if (!post) return;
    if (!isLoggedIn) {
      Alert.alert('提示', '请先登录后再点赞');
      return;
    }
    try {
      if (post.isLiked) {
        await communityApi.unlikePost(post.id);
      } else {
        await communityApi.likePost(post.id);
      }
      setPost((prev) =>
        prev
          ? {
              ...prev,
              isLiked: !prev.isLiked,
              likeCount: prev.isLiked
                ? prev.likeCount - 1
                : prev.likeCount + 1,
            }
          : prev,
      );
    } catch (err) {
      logError('PostDetailScreen.handleLikeToggle', err);
      Alert.alert('错误', '操作失败，请稍后重试');
    }
  }, [isLoggedIn, post]);

  const handleSubmitComment = useCallback(async () => {
    if (!isLoggedIn) {
      Alert.alert('提示', '请先登录后再评论');
      return;
    }
    if (!commentText.trim()) {
      Alert.alert('提示', '请输入评论内容');
      return;
    }
    try {
      setSubmitting(true);
      await communityApi.createComment(id, { content: commentText.trim() });
      setCommentText('');
      fetchComments();
      setPost((prev) =>
        prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev,
      );
    } catch (err) {
      Alert.alert('错误', '评论失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }, [commentText, fetchComments, id, isLoggedIn]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME_PRIMARY} />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.emptyText}>帖子不存在或已被删除</Text>
      </View>
    );
  }

  const authorAvatarSource = getSafeRemoteImageSource(post.author?.avatar);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container}>
        <Card style={styles.postCard}>
          <Card.Content>
            <View style={styles.authorRow}>
              {authorAvatarSource ? (
                <Avatar.Image size={40} source={authorAvatarSource} />
              ) : (
                <Avatar.Icon
                  size={40}
                  icon="account"
                  style={styles.avatarIcon}
                />
              )}
              <View style={styles.authorInfo}>
                <View style={styles.authorNameRow}>
                  <Text style={styles.authorName}>
                    {post.author?.nickname ?? '匿名用户'}
                  </Text>
                  {post.author?.isVerifiedMember ? (
                    <Chip compact style={styles.verifiedChip} textStyle={styles.verifiedChipText}>
                      已验证妈妈
                    </Chip>
                  ) : null}
                </View>
                <Text style={styles.postDate}>{post.createdAt}</Text>
              </View>
            </View>

            <View style={styles.titleRow}>
              {post.isPinned && (
                <Chip compact style={styles.pinnedChip} textStyle={styles.pinnedChipText}>
                  置顶
                </Chip>
              )}
              <Text style={styles.postTitle}>{post.title}</Text>
            </View>

            {!!post.category && (
              <Chip compact style={styles.categoryChip} textStyle={styles.categoryChipText}>
                {post.category}
              </Chip>
            )}

            <Text style={styles.postContent}>{post.content}</Text>

            <View style={styles.statsRow}>
              <Button
                icon={post.isLiked ? 'heart' : 'heart-outline'}
                textColor={post.isLiked ? '#ff4d4f' : '#999'}
                onPress={handleLikeToggle}
                compact
              >
                {post.likeCount}
              </Button>
              <Button icon="comment-outline" textColor="#999" compact disabled>
                {post.commentCount}
              </Button>
              <Button icon="eye-outline" textColor="#999" compact disabled>
                {post.viewCount}
              </Button>
            </View>
          </Card.Content>
        </Card>

        <Divider style={styles.divider} />

        <View style={styles.commentSection}>
          <Text style={styles.commentSectionTitle}>
            评论 ({post.commentCount})
          </Text>

          <View style={styles.commentInputRow}>
            <TextInput
              placeholder="写下你的评论..."
              value={commentText}
              onChangeText={setCommentText}
              mode="outlined"
              style={styles.commentInput}
              activeOutlineColor={THEME_PRIMARY}
              dense
            />
            <Button
              mode="contained"
              onPress={handleSubmitComment}
              loading={submitting}
              disabled={submitting}
              buttonColor={THEME_PRIMARY}
              style={styles.commentSubmitButton}
            >
              发送
            </Button>
          </View>

          {comments.length === 0 ? (
            <Text style={styles.emptyText}>暂无评论，快来抢沙发吧</Text>
          ) : (
            comments.map((comment) => {
              const commentAvatarSource = getSafeRemoteImageSource(comment.author?.avatar);

              return (
                <View key={comment.id} style={styles.commentItem}>
                  <View style={styles.commentAuthorRow}>
                    {commentAvatarSource ? (
                      <Avatar.Image
                        size={30}
                        source={commentAvatarSource}
                      />
                    ) : (
                      <Avatar.Icon
                        size={30}
                        icon="account"
                        style={styles.avatarIcon}
                      />
                    )}
                    <View style={styles.commentAuthorInfo}>
                      <View style={styles.commentAuthorNameRow}>
                        <Text style={styles.commentAuthorName}>
                          {comment.author?.nickname ?? '匿名用户'}
                        </Text>
                        {comment.author?.isVerifiedMember ? (
                          <Chip compact style={styles.commentVerifiedChip} textStyle={styles.commentVerifiedChipText}>
                            已验证妈妈
                          </Chip>
                        ) : null}
                      </View>
                      <Text style={styles.commentDate}>{comment.createdAt}</Text>
                    </View>
                  </View>
                  <Text style={styles.commentContent}>{comment.content}</Text>
                  <Divider style={styles.commentDivider} />
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  postCard: {
    margin: 16,
    backgroundColor: '#fff',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarIcon: {
    backgroundColor: '#e0e0e0',
  },
  authorInfo: {
    marginLeft: 12,
  },
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  verifiedChip: {
    backgroundColor: '#fff3e6',
    height: 22,
  },
  verifiedChipText: {
    color: '#d66a31',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  postDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
    flexWrap: 'wrap',
  },
  pinnedChip: {
    backgroundColor: '#ff4d4f',
    height: 22,
  },
  pinnedChipText: {
    color: '#fff',
    fontSize: 10,
    lineHeight: 13,
  },
  postTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  categoryChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#e6f7ff',
    marginBottom: 12,
  },
  categoryChipText: {
    color: THEME_PRIMARY,
    fontSize: 12,
  },
  postContent: {
    fontSize: 15,
    color: '#444',
    lineHeight: 24,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  divider: {
    marginHorizontal: 16,
  },
  commentSection: {
    padding: 16,
  },
  commentSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#fff',
  },
  commentSubmitButton: {
    marginTop: 6,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 20,
    fontSize: 14,
  },
  commentItem: {
    marginBottom: 4,
  },
  commentAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  commentAuthorInfo: {
    marginLeft: 10,
  },
  commentAuthorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentAuthorName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  commentVerifiedChip: {
    backgroundColor: '#eef6ff',
    height: 20,
  },
  commentVerifiedChipText: {
    color: '#176db8',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
  },
  commentDate: {
    fontSize: 11,
    color: '#999',
    marginTop: 1,
  },
  commentContent: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
    marginLeft: 40,
    marginBottom: 10,
  },
  commentDivider: {
    marginVertical: 8,
  },
});

export default PostDetailScreen;
