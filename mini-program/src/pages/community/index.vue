<template>
  <view class="community-page">
    <!-- Header -->
    <view class="header">
      <text class="header-title">社区交流</text>
      <view class="header-btn" @tap="onCreatePost">
        <text class="header-btn-text">+ 发帖</text>
      </view>
    </view>

    <!-- Search Bar -->
    <view class="search-bar">
      <input
        v-model="keyword"
        class="search-input"
        placeholder="搜索帖子..."
        confirm-type="search"
        @confirm="onSearch"
      />
    </view>

    <!-- Filters -->
    <view class="filter-row">
      <picker :range="sortOptions" range-key="label" :value="sortIndex" @change="onSortChange">
        <view class="filter-picker">
          <text class="filter-text">{{ sortOptions[sortIndex].label }}</text>
          <text class="filter-arrow">▼</text>
        </view>
      </picker>
    </view>

    <!-- Post List -->
    <view v-if="loading && posts.length === 0" class="loading-box">
      <text class="loading-text">加载中...</text>
    </view>

    <view v-else-if="posts.length === 0" class="empty-box">
      <text class="empty-text">暂无帖子</text>
    </view>

    <view v-else class="post-list">
      <view
        v-for="post in posts"
        :key="post.id"
        class="post-card"
        @tap="goToDetail(post.id)"
      >
        <!-- Author Row -->
        <view class="post-author-row">
          <view class="avatar avatar-fallback">
            <text class="avatar-text">{{ post.isAnonymous ? '匿' : ((post.author?.nickname || post.author?.username || '用')[0]) }}</text>
          </view>
          <view class="author-info">
            <text class="author-name">
              {{ post.isAnonymous ? '匿名用户' : (post.author?.nickname || post.author?.username || '用户') }}
            </text>
            <text class="post-date">{{ formatDate(post.createdAt) }}</text>
          </view>
        </view>

        <!-- Title -->
        <view class="post-title-row">
          <view v-if="post.isPinned" class="pin-tag">
            <text class="pin-tag-text">置顶</text>
          </view>
          <text class="post-title">{{ post.title }}</text>
        </view>

        <!-- Content Preview -->
        <text class="post-preview">{{ post.content }}</text>

        <!-- Footer -->
        <view class="post-footer">
          <view v-if="post.categoryName || post.category" class="category-tag">
            <text class="category-tag-text">{{ post.categoryName || post.category }}</text>
          </view>
          <view class="post-stats">
            <view class="stat-item" @tap.stop="onToggleLike(post)">
              <text class="stat-icon" :class="{ 'stat-icon--liked': post.isLiked }">♥</text>
              <text class="stat-num">{{ post.likeCount || 0 }}</text>
            </view>
            <view class="stat-item">
              <text class="stat-icon">💬</text>
              <text class="stat-num">{{ post.commentCount || 0 }}</text>
            </view>
            <view class="stat-item">
              <text class="stat-icon">👁</text>
              <text class="stat-num">{{ post.viewCount || 0 }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- Pagination -->
      <view v-if="pagination.totalPages > 1" class="pagination">
        <view
          class="page-btn"
          :class="{ 'page-btn--disabled': pagination.page <= 1 }"
          @tap="changePage(pagination.page - 1)"
        >
          <text class="page-btn-text">上一页</text>
        </view>
        <text class="page-info">{{ pagination.page }} / {{ pagination.totalPages }}</text>
        <view
          class="page-btn"
          :class="{ 'page-btn--disabled': pagination.page >= pagination.totalPages }"
          @tap="changePage(pagination.page + 1)"
        >
          <text class="page-btn-text">下一页</text>
        </view>
      </view>
    </view>

    <!-- Create Post Modal -->
    <view v-if="showCreateModal" class="modal-mask" @tap.self="showCreateModal = false">
      <view class="modal-content">
        <text class="modal-title">发布帖子</text>

        <view class="form-item">
          <text class="form-label">标题</text>
          <input
            v-model="postForm.title"
            class="form-input"
            placeholder="请输入标题"
          />
        </view>

        <view class="form-item">
          <text class="form-label">分类</text>
          <picker :range="categoryOptions" range-key="name" :value="selectedCategoryIndex" @change="onCategoryChange">
            <view class="form-picker">
              <text :class="postForm.categoryId ? 'form-picker-text' : 'placeholder-text'">
                {{ selectedCategoryLabel }}
              </text>
            </view>
          </picker>
        </view>

        <view class="form-item">
          <text class="form-label">内容</text>
          <textarea
            v-model="postForm.content"
            class="form-textarea"
            placeholder="分享你的经验和想法..."
          />
        </view>
        <view class="form-item form-item--switch">
          <text class="form-label">匿名发布</text>
          <switch :checked="postForm.isAnonymous" color="#2ea97d" @change="onAnonymousChange" />
        </view>
        <view class="modal-actions">
          <view class="modal-btn modal-btn--cancel" @tap="showCreateModal = false">
            <text class="modal-btn-text">取消</text>
          </view>
          <view class="modal-btn modal-btn--confirm" @tap="submitPost">
            <text class="modal-btn-text modal-btn-text--white">发布</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, reactive, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { communityApi } from '@/api/community'
import type { CommunityPost } from '@/api/community'
import { categoryApi, type Category } from '@/api/modules'
import dayjs from 'dayjs'

const sortOptions = [
  { label: '最新', value: 'latest' },
  { label: '最热', value: 'hot' },
  { label: '最多赞', value: 'popular' },
]

const keyword = ref('')
const sortIndex = ref(0)
const loading = ref(false)
const posts = ref<CommunityPost[]>([])
const categories = ref<Array<Pick<Category, 'id' | 'name'>>>([])
const pagination = reactive({ page: 1, pageSize: 10, total: 0, totalPages: 0 })
const showCreateModal = ref(false)
const postForm = reactive({ title: '', content: '', categoryId: '', isAnonymous: false })
const categoryOptions = computed(() => [{ id: '', name: '不分类' }, ...categories.value])
const selectedCategoryIndex = computed(() => {
  const index = categoryOptions.value.findIndex(item => String(item.id) === postForm.categoryId)
  return index >= 0 ? index : 0
})
const selectedCategoryLabel = computed(() => {
  return categoryOptions.value[selectedCategoryIndex.value]?.name || '不分类'
})

const formatDate = (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm')

const fetchCategories = async () => {
  try {
    const res = await categoryApi.getAll()
    categories.value = (res || []).map(item => ({ id: item.id, name: item.name }))
  } catch (_err) {
    categories.value = []
  }
}

const fetchPosts = async () => {
  loading.value = true
  try {
    const params: Record<string, unknown> = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      sort: sortOptions[sortIndex.value].value,
    }
    if (keyword.value.trim()) {
      params.keyword = keyword.value.trim()
    }
    const res = await communityApi.getPosts(params as any) as any
    posts.value = res.list || []
    if (res.pagination) {
      pagination.page = res.pagination.page
      pagination.total = res.pagination.total
      pagination.totalPages = res.pagination.totalPages
    }
  } catch (err) {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const onSearch = () => {
  pagination.page = 1
  fetchPosts()
}

const onSortChange = (e: any) => {
  sortIndex.value = e.detail.value
  pagination.page = 1
  fetchPosts()
}

const changePage = (page: number) => {
  if (page < 1 || page > pagination.totalPages) return
  pagination.page = page
  fetchPosts()
}

const goToDetail = (id: number) => {
  uni.navigateTo({ url: `/pages/post-detail/index?id=${id}` })
}

const onToggleLike = async (post: CommunityPost) => {
  try {
    if (post.isLiked) {
      await communityApi.unlikePost(post.id)
      post.isLiked = false
      post.likeCount--
    } else {
      await communityApi.likePost(post.id)
      post.isLiked = true
      post.likeCount++
    }
  } catch (_err) {
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

const checkLogin = (): boolean => {
  const token = uni.getStorageSync('token')
  if (!token) {
    uni.navigateTo({ url: '/pages/login/index' })
    return false
  }
  return true
}

const onCreatePost = () => {
  if (!checkLogin()) return
  postForm.title = ''
  postForm.content = ''
  postForm.categoryId = ''
  postForm.isAnonymous = false
  showCreateModal.value = true
}

const onCategoryChange = (e: any) => {
  const target = categoryOptions.value[e.detail.value]
  postForm.categoryId = target ? String(target.id || '') : ''
}

const onAnonymousChange = (e: any) => {
  postForm.isAnonymous = Boolean(e.detail.value)
}

const submitPost = async () => {
  if (!postForm.title.trim()) {
    uni.showToast({ title: '请输入标题', icon: 'none' })
    return
  }
  if (!postForm.content.trim()) {
    uni.showToast({ title: '请输入内容', icon: 'none' })
    return
  }
  try {
    await communityApi.createPost({
      title: postForm.title.trim(),
      content: postForm.content.trim(),
      categoryId: postForm.categoryId || undefined,
      isAnonymous: postForm.isAnonymous,
    })
    showCreateModal.value = false
    uni.showToast({ title: '发布成功', icon: 'success' })
    pagination.page = 1
    fetchPosts()
  } catch (_err) {
    uni.showToast({ title: '发布失败', icon: 'none' })
  }
}

onMounted(() => {
  fetchCategories()
  fetchPosts()
})

onShow(() => {
  fetchPosts()
})
</script>

<style scoped>
.community-page {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding-bottom: 40rpx;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 32rpx;
  background-color: #ffffff;
}

.header-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333333;
}

.header-btn {
  background-color: #1890ff;
  border-radius: 32rpx;
  padding: 12rpx 28rpx;
}

.header-btn-text {
  color: #ffffff;
  font-size: 26rpx;
}

.search-bar {
  padding: 16rpx 32rpx;
  background-color: #ffffff;
}

.search-input {
  background-color: #f5f5f5;
  border-radius: 32rpx;
  padding: 16rpx 28rpx;
  font-size: 28rpx;
}

.filter-row {
  display: flex;
  gap: 20rpx;
  padding: 16rpx 32rpx;
  background-color: #ffffff;
  border-bottom: 1rpx solid #f0f0f0;
}

.filter-picker {
  display: flex;
  align-items: center;
  background-color: #f5f5f5;
  border-radius: 24rpx;
  padding: 10rpx 24rpx;
  gap: 8rpx;
}

.filter-text {
  font-size: 26rpx;
  color: #333333;
}

.filter-arrow {
  font-size: 20rpx;
  color: #999999;
}

.loading-box,
.empty-box {
  display: flex;
  justify-content: center;
  padding: 100rpx 0;
}

.loading-text,
.empty-text {
  font-size: 28rpx;
  color: #999999;
}

.post-list {
  padding: 16rpx 32rpx;
}

.post-card {
  background-color: #ffffff;
  border-radius: 16rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.05);
}

.post-author-row {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}

.avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  margin-right: 16rpx;
  background-color: #eeeeee;
}

.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(24, 144, 255, 0.15);
}

.avatar-text {
  font-size: 26rpx;
  font-weight: bold;
  color: #1890ff;
}

.author-info {
  display: flex;
  flex-direction: column;
}

.author-name {
  font-size: 26rpx;
  color: #333333;
  font-weight: 500;
}

.post-date {
  font-size: 22rpx;
  color: #999999;
  margin-top: 4rpx;
}

.post-title-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-bottom: 12rpx;
}

.pin-tag {
  background-color: #ff4d4f;
  border-radius: 6rpx;
  padding: 2rpx 10rpx;
  flex-shrink: 0;
}

.pin-tag-text {
  font-size: 20rpx;
  color: #ffffff;
}

.post-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333333;
}

.post-preview {
  font-size: 26rpx;
  color: #666666;
  line-height: 1.6;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  margin-bottom: 16rpx;
}

.post-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.category-tag {
  background-color: #e6f7ff;
  border-radius: 6rpx;
  padding: 4rpx 14rpx;
}

.category-tag-text {
  font-size: 22rpx;
  color: #1890ff;
}

.post-stats {
  display: flex;
  gap: 24rpx;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.stat-icon {
  font-size: 24rpx;
}

.stat-icon--liked {
  color: #ff4d4f;
}

.stat-num {
  font-size: 22rpx;
  color: #999999;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24rpx 0;
  gap: 24rpx;
}

.page-btn {
  background-color: #ffffff;
  border: 1rpx solid #d9d9d9;
  border-radius: 8rpx;
  padding: 12rpx 28rpx;
}

.page-btn--disabled {
  opacity: 0.4;
}

.page-btn-text {
  font-size: 26rpx;
  color: #333333;
}

.page-info {
  font-size: 26rpx;
  color: #666666;
}

/* Modal */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 999;
}

.modal-content {
  width: 640rpx;
  background-color: #ffffff;
  border-radius: 20rpx;
  padding: 40rpx;
  max-height: 80vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.modal-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #333333;
  text-align: center;
  margin-bottom: 32rpx;
}

.form-item {
  margin-bottom: 24rpx;
}

.form-item--switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.form-label {
  font-size: 28rpx;
  color: #333333;
  margin-bottom: 8rpx;
}

.form-picker-text {
  font-size: 28rpx;
  color: #333333;
}

.form-input {
  border: 1rpx solid #d9d9d9;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  font-size: 28rpx;
  width: 100%;
  box-sizing: border-box;
}

.form-textarea {
  border: 1rpx solid #d9d9d9;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  font-size: 28rpx;
  width: 100%;
  height: 240rpx;
  box-sizing: border-box;
}

.form-picker {
  border: 1rpx solid #d9d9d9;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
}

.placeholder-text {
  color: #cccccc;
  font-size: 28rpx;
}

.modal-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 32rpx;
}

.modal-btn {
  flex: 1;
  border-radius: 12rpx;
  padding: 18rpx 0;
  text-align: center;
}

.modal-btn--cancel {
  background-color: #f5f5f5;
}

.modal-btn--confirm {
  background-color: #1890ff;
}

.modal-btn-text {
  font-size: 30rpx;
  color: #666666;
  text-align: center;
}

.modal-btn-text--white {
  color: #ffffff;
}
</style>
