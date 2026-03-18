import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  SafeAreaView,
  FlatList,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  Searchbar,
  Chip,
  Modal,
  Portal,
  TextInput,
  Avatar,
  IconButton,
  ActivityIndicator,
} from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { communityApi } from '../api/community';

const THEME_PRIMARY = '#1890ff';

const SORT_OPTIONS = [
  { key: 'latest', label: '最新' },
  { key: 'hot', label: '最热' },
  { key: 'popular', label: '最受欢迎' },
];

const CATEGORIES = [
  '全部',
  '孕期生活',
  '育儿交流',
  '营养健康',
  '分娩经验',
  '宝宝成长',
];

interface Post {
  id: number;
  title: string;
  content: string;
  category?: string;
  author?: {
    id: number | string;
    nickname?: string;
    username?: string;
    avatar?: string;
  };
  createdAt: string;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  isLiked?: boolean;
  isPinned?: boolean;
}

const CommunityScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('latest');
  const [category, setCategory] = useState('全部');
  const [modalVisible, setModalVisible] = useState(false);

  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState('孕期生活');

  const loadingMore = useRef(false);

  const fetchPosts = useCallback(
    async (pageNum: number, refresh = false) => {
      if (loading && !refresh) return;
      try {
        if (refresh) setRefreshing(true);
        else setLoading(true);

        const params: any = { page: pageNum, sort: sortBy };
        if (category !== '全部') params.category = category;
        if (searchQuery.trim()) params.keyword = searchQuery.trim();

        const res = await communityApi.getPosts(params);
        const newPosts: Post[] = res?.list ?? [];

        if (refresh || pageNum === 1) {
          setPosts(newPosts);
        } else {
          setPosts((prev) => [...prev, ...newPosts]);
        }
        setHasMore(newPosts.length >= 10);
        setPage(pageNum);
      } catch (err) {
        console.error('Failed to fetch posts', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
        loadingMore.current = false;
      }
    },
    [sortBy, category, searchQuery, loading],
  );

  useEffect(() => {
    fetchPosts(1, true);
  }, [sortBy, category]);

  const handleSearch = useCallback(() => {
    fetchPosts(1, true);
  }, [fetchPosts]);

  const handleRefresh = useCallback(() => {
    fetchPosts(1, true);
  }, [fetchPosts]);

  const handleLoadMore = useCallback(() => {
    if (!hasMore || loadingMore.current) return;
    loadingMore.current = true;
    fetchPosts(page + 1);
  }, [hasMore, page, fetchPosts]);

  const handleLikeToggle = useCallback(
    async (post: Post) => {
      try {
        if (post.isLiked) {
          await communityApi.unlikePost(post.id);
        } else {
          await communityApi.likePost(post.id);
        }
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? {
                  ...p,
                  isLiked: !p.isLiked,
                  likeCount: p.isLiked ? p.likeCount - 1 : p.likeCount + 1,
                }
              : p,
          ),
        );
      } catch (err) {
        console.error('Like toggle failed', err);
      }
    },
    [],
  );

  const checkLoginAndOpenModal = useCallback(async () => {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      Alert.alert('提示', '请先登录后再发帖');
      return;
    }
    setFormTitle('');
    setFormContent('');
    setFormCategory('孕期生活');
    setModalVisible(true);
  }, []);

  const handleSubmitPost = useCallback(async () => {
    if (!formTitle.trim()) {
      Alert.alert('提示', '请输入帖子标题');
      return;
    }
    if (!formContent.trim()) {
      Alert.alert('提示', '请输入帖子内容');
      return;
    }
    try {
      await communityApi.createPost({
        title: formTitle.trim(),
        content: formContent.trim(),
        category: formCategory,
      });
      setModalVisible(false);
      fetchPosts(1, true);
    } catch (err) {
      Alert.alert('错误', '发帖失败，请稍后重试');
    }
  }, [formTitle, formContent, formCategory, fetchPosts]);

  const renderPostItem = useCallback(
    ({ item }: { item: Post }) => (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => navigation.navigate('PostDetail', { id: item.id })}
      >
        <Card style={styles.postCard}>
          <Card.Content>
            <View style={styles.authorRow}>
              {item.author?.avatar ? (
                <Avatar.Image size={32} source={{ uri: item.author.avatar }} />
              ) : (
                <Avatar.Icon
                  size={32}
                  icon="account"
                  style={styles.avatarIcon}
                />
              )}
              <View style={styles.authorInfo}>
                <Text style={styles.authorName}>
                  {item.author?.nickname ?? '匿名用户'}
                </Text>
                <Text style={styles.postDate}>{item.createdAt}</Text>
              </View>
            </View>

            <View style={styles.titleRow}>
              {item.isPinned && (
                <Chip compact style={styles.pinnedChip} textStyle={styles.pinnedChipText}>
                  置顶
                </Chip>
              )}
              <Text style={styles.postTitle} numberOfLines={1}>
                {item.title}
              </Text>
            </View>

            <Text style={styles.postContent} numberOfLines={2}>
              {item.content}
            </Text>

            <View style={styles.statsRow}>
              <TouchableOpacity
                style={styles.statItem}
                onPress={() => handleLikeToggle(item)}
              >
                <IconButton
                  icon={item.isLiked ? 'heart' : 'heart-outline'}
                  size={16}
                  iconColor={item.isLiked ? '#ff4d4f' : '#999'}
                  style={styles.statIcon}
                />
                <Text style={styles.statText}>{item.likeCount}</Text>
              </TouchableOpacity>
              <View style={styles.statItem}>
                <IconButton
                  icon="comment-outline"
                  size={16}
                  iconColor="#999"
                  style={styles.statIcon}
                />
                <Text style={styles.statText}>{item.commentCount}</Text>
              </View>
              <View style={styles.statItem}>
                <IconButton
                  icon="eye-outline"
                  size={16}
                  iconColor="#999"
                  style={styles.statIcon}
                />
                <Text style={styles.statText}>{item.viewCount}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      </TouchableOpacity>
    ),
    [navigation, handleLikeToggle],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>社区交流</Text>
        <Button
          mode="contained"
          icon="pencil"
          onPress={checkLoginAndOpenModal}
          buttonColor={THEME_PRIMARY}
        >
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

      <View style={styles.filterRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORIES}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <Chip
              selected={category === item}
              onPress={() => setCategory(item)}
              style={[
                styles.filterChip,
                category === item && styles.filterChipSelected,
              ]}
              textStyle={
                category === item
                  ? styles.filterChipTextSelected
                  : styles.filterChipText
              }
            >
              {item}
            </Chip>
          )}
          contentContainerStyle={styles.filterList}
        />
      </View>

      <View style={styles.sortRow}>
        {SORT_OPTIONS.map((opt) => (
          <Chip
            key={opt.key}
            selected={sortBy === opt.key}
            onPress={() => setSortBy(opt.key)}
            style={[
              styles.sortChip,
              sortBy === opt.key && styles.sortChipSelected,
            ]}
            textStyle={
              sortBy === opt.key
                ? styles.sortChipTextSelected
                : styles.sortChipText
            }
          >
            {opt.label}
          </Chip>
        ))}
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderPostItem}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.emptyText}>暂无帖子</Text>
          ) : null
        }
        ListFooterComponent={
          loading && posts.length > 0 ? (
            <ActivityIndicator style={styles.footerLoader} color={THEME_PRIMARY} />
          ) : null
        }
      />

      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Text style={styles.modalTitle}>发布帖子</Text>

          <TextInput
            label="标题"
            value={formTitle}
            onChangeText={setFormTitle}
            mode="outlined"
            style={styles.input}
            activeOutlineColor={THEME_PRIMARY}
          />

          <TextInput
            label="内容"
            value={formContent}
            onChangeText={setFormContent}
            mode="outlined"
            multiline
            numberOfLines={6}
            style={styles.input}
            activeOutlineColor={THEME_PRIMARY}
          />

          <Text style={styles.fieldLabel}>分类</Text>
          <View style={styles.categoryPicker}>
            {CATEGORIES.filter((c) => c !== '全部').map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setFormCategory(c)}
                style={[
                  styles.categoryOption,
                  formCategory === c && styles.categoryOptionSelected,
                ]}
              >
                <Text
                  style={{
                    color: formCategory === c ? '#fff' : '#333',
                    fontSize: 13,
                  }}
                >
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Button
            mode="contained"
            onPress={handleSubmitPost}
            style={styles.submitButton}
            buttonColor={THEME_PRIMARY}
          >
            发布
          </Button>
          <Button mode="text" onPress={() => setModalVisible(false)}>
            取消
          </Button>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  searchBar: {
    marginHorizontal: 16,
    marginTop: 8,
    elevation: 1,
  },
  filterRow: {
    marginTop: 8,
  },
  filterList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#f0f0f0',
  },
  filterChipSelected: {
    backgroundColor: THEME_PRIMARY,
  },
  filterChipText: {
    color: '#666',
  },
  filterChipTextSelected: {
    color: '#fff',
  },
  sortRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  sortChip: {
    backgroundColor: '#f0f0f0',
  },
  sortChipSelected: {
    backgroundColor: THEME_PRIMARY,
  },
  sortChipText: {
    color: '#666',
  },
  sortChipTextSelected: {
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  postCard: {
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarIcon: {
    backgroundColor: '#e0e0e0',
  },
  authorInfo: {
    marginLeft: 10,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  postDate: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  postContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  statIcon: {
    margin: 0,
    width: 20,
    height: 20,
  },
  statText: {
    fontSize: 12,
    color: '#999',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
    fontSize: 14,
  },
  footerLoader: {
    paddingVertical: 16,
  },
  modalContainer: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  fieldLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  categoryPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  categoryOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#f0f0f0',
  },
  categoryOptionSelected: {
    backgroundColor: THEME_PRIMARY,
  },
  submitButton: {
    marginBottom: 8,
  },
});

export default CommunityScreen;
