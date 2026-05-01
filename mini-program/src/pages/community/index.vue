<template>
  <view class="community-page">
    <!-- 排序标签 -->
    <view class="sort-tabs">
      <view
        v-for="tab in sortTabs"
        :key="tab.value"
        class="sort-tab"
        :class="{ active: currentSort === tab.value }"
        @tap="changeSort(tab.value)"
      >
        <text>{{ tab.label }}</text>
      </view>
      <view class="sort-tab compose-btn" @tap="onCompose">
        <text>发帖</text>
      </view>
    </view>

    <!-- 帖子列表 -->
    <scroll-view scroll-y class="post-list" @scrolltolower="loadMore">
      <SkeletonCard v-if="loading && !posts.length" v-for="i in 3" :key="i" :rows="3" :avatar="true" />

      <view v-if="!loading && !posts.length" class="empty-state">
        <text class="empty-text">还没有帖子，快来发第一篇吧</text>
      </view>

      <view
        v-for="post in posts"
        :key="post.id"
        class="post-card"
        @tap="openPost(post.id)"
      >
        <view class="post-header">
          <view class="post-avatar">
            <text>{{ post.author?.nickname?.[0] || '匿' }}</text>
          </view>
          <view class="post-author-info">
            <text class="post-author-name">{{ post.isAnonymous ? '匿名用户' : (post.author?.nickname || post.author?.username || '用户') }}</text>
            <text class="post-time">{{ formatTime(post.createdAt) }}</text>
          </view>
          <view v-if="post.isPinned" class="post-pin-badge">
            <text>置顶</text>
          </view>
        </view>

        <text class="post-title">{{ post.title }}</text>
        <text class="post-content-preview">{{ post.content.slice(0, 100) }}</text>

        <view v-if="post.tags?.length" class="post-tags">
          <text v-for="tag in post.tags.slice(0, 3)" :key="tag.id" class="post-tag">{{ tag.name }}</text>
        </view>

        <view class="post-footer">
          <view class="post-stat">
            <text>{{ post.likeCount }} 赞</text>
          </view>
          <view class="post-stat">
            <text>{{ post.commentCount }} 评论</text>
          </view>
          <view class="post-stat">
            <text>{{ post.viewCount }} 浏览</text>
          </view>
        </view>
      </view>

      <view v-if="loading && posts.length" class="loading-more">
        <text>加载中...</text>
      </view>

      <view v-if="noMore && posts.length" class="no-more">
        <text>没有更多了</text>
      </view>
    </scroll-view>

    <!-- 发帖弹窗 -->
    <view v-if="showCompose" class="compose-overlay" @tap="showCompose = false">
      <view class="compose-panel" @tap.stop>
        <view class="compose-header">
          <text class="compose-title">发帖</text>
          <text class="compose-close" @tap="showCompose = false">取消</text>
        </view>
        <input v-model="composeTitle" class="compose-input" placeholder="标题" />
        <textarea v-model="composeContent" class="compose-textarea" placeholder="分享你的经验和问题..." :maxlength="2000" />
        <view class="compose-footer">
          <label class="compose-anon">
            <checkbox :checked="composeAnonymous" @tap="composeAnonymous = !composeAnonymous" />
            <text>匿名发布</text>
          </label>
          <view class="compose-submit" :class="{ disabled: !canSubmit }" @tap="submitPost">
            <text>发布</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { communityApi, type CommunityPost } from '@/api/community'
import SkeletonCard from '@/components/SkeletonCard.vue'
import dayjs from 'dayjs'

const sortTabs = [
  { label: '最新', value: 'latest' },
  { label: '热门', value: 'popular' },
  { label: '热议', value: 'hot' },
]

const currentSort = ref('latest')
const posts = ref<CommunityPost[]>([])
const loading = ref(false)
const page = ref(1)
const noMore = ref(false)

const showCompose = ref(false)
const composeTitle = ref('')
const composeContent = ref('')
const composeAnonymous = ref(false)

const canSubmit = computed(() => composeTitle.value.trim() && composeContent.value.trim())

function formatTime(dateStr: string) {
  const d = dayjs(dateStr)
  const now = dayjs()
  if (d.isSame(now, 'day')) return d.format('HH:mm')
  if (d.isSame(now.subtract(1, 'day'), 'day')) return '昨天'
  return d.format('MM/DD')
}

async function loadPosts(reset = false) {
  if (loading.value) return
  if (reset) {
    page.value = 1
    noMore.value = false
  }
  if (noMore.value) return

  loading.value = true
  try {
    const res = await communityApi.getPosts({ sort: currentSort.value, page: page.value, pageSize: 20 })
    const newPosts = res.list || []
    if (reset) {
      posts.value = newPosts
    } else {
      posts.value.push(...newPosts)
    }
    if (newPosts.length < 20) noMore.value = true
    page.value++
  } catch (e) {
    console.error('[Community] 加载失败:', e)
  } finally {
    loading.value = false
  }
}

function changeSort(sort: string) {
  currentSort.value = sort
  loadPosts(true)
}

function loadMore() {
  if (!noMore.value) loadPosts()
}

function openPost(id: string) {
  uni.navigateTo({ url: `/pages/community/detail?id=${id}` })
}

function onCompose() {
  if (!uni.getStorageSync('token')) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    setTimeout(() => uni.navigateTo({ url: '/pages/login/index' }), 900)
    return
  }
  showCompose.value = true
}

async function submitPost() {
  if (!canSubmit.value) return
  try {
    await communityApi.createPost({
      title: composeTitle.value.trim(),
      content: composeContent.value.trim(),
      isAnonymous: composeAnonymous.value,
    })
    uni.showToast({ title: '发布成功', icon: 'success' })
    showCompose.value = false
    composeTitle.value = ''
    composeContent.value = ''
    composeAnonymous.value = false
    loadPosts(true)
  } catch (e: any) {
    uni.showToast({ title: e.message || '发布失败', icon: 'none' })
  }
}

onShow(() => { loadPosts(true) })
</script>

<style scoped>
.community-page { min-height: 100vh; background: #f5f7fa; }
.sort-tabs { display: flex; padding: 16rpx 24rpx; gap: 16rpx; background: #fffcf8; border-bottom: 1rpx solid #f0f0f0; }
.sort-tab { padding: 12rpx 24rpx; border-radius: 24rpx; font-size: 26rpx; color: #666; background: #f5f7fa; }
.sort-tab.active { background: #16806a; color: #fff; }
.compose-btn { margin-left: auto; background: #16806a; color: #fff; }
.post-list { height: calc(100vh - 100rpx); }
.empty-state { padding: 120rpx 40rpx; text-align: center; }
.empty-text { color: #999; font-size: 28rpx; }
.post-card { margin: 16rpx 24rpx; padding: 24rpx; background: #fffcf8; border-radius: 20rpx; box-shadow: 0 4rpx 16rpx rgba(31, 42, 55, 0.02); }
.post-header { display: flex; align-items: center; gap: 16rpx; margin-bottom: 16rpx; }
.post-avatar { width: 64rpx; height: 64rpx; border-radius: 50%; background: #16806a; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 24rpx; font-weight: 600; flex-shrink: 0; }
.post-author-info { flex: 1; }
.post-author-name { display: block; font-size: 26rpx; font-weight: 600; color: #444; }
.post-time { display: block; font-size: 22rpx; color: #bbb; margin-top: 4rpx; }
.post-pin-badge { background: #ff4d4f; color: #fff; font-size: 20rpx; padding: 4rpx 12rpx; border-radius: 8rpx; }
.post-title { display: block; font-size: 30rpx; font-weight: 700; color: #444; margin-bottom: 12rpx; line-height: 1.4; }
.post-content-preview { display: block; font-size: 26rpx; color: #666; line-height: 1.6; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.post-tags { display: flex; gap: 8rpx; margin-top: 12rpx; flex-wrap: wrap; }
.post-tag { font-size: 22rpx; color: #16806a; background: rgba(22, 128, 106, 0.1); padding: 4rpx 12rpx; border-radius: 8rpx; }
.post-footer { display: flex; gap: 24rpx; margin-top: 16rpx; padding-top: 16rpx; border-top: 1rpx solid #f5f5f5; }
.post-stat { font-size: 22rpx; color: #999; }
.loading-more, .no-more { text-align: center; padding: 24rpx; color: #bbb; font-size: 24rpx; }
.compose-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.4); z-index: 100; display: flex; align-items: flex-end; }
.compose-panel { width: 100%; background: #fffcf8; border-radius: 32rpx 32rpx 0 0; padding: 32rpx; }
.compose-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24rpx; }
.compose-title { font-size: 32rpx; font-weight: 700; color: #444; }
.compose-close { font-size: 28rpx; color: #999; }
.compose-input { width: 100%; padding: 20rpx; border: 1rpx solid #e8e8e8; border-radius: 12rpx; font-size: 28rpx; margin-bottom: 16rpx; }
.compose-textarea { width: 100%; height: 300rpx; padding: 20rpx; border: 1rpx solid #e8e8e8; border-radius: 12rpx; font-size: 26rpx; }
.compose-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 24rpx; }
.compose-anon { display: flex; align-items: center; gap: 8rpx; font-size: 26rpx; color: #666; }
.compose-submit { background: #16806a; color: #fff; padding: 16rpx 40rpx; border-radius: 24rpx; font-size: 28rpx; font-weight: 600; }
.compose-submit.disabled { opacity: 0.5; }
</style>
