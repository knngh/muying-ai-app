<template>
  <view class="name-page">
    <view class="name-hero">
      <view class="hero-badge">起名灵感 · 预览</view>
      <text class="hero-title">给宝宝挑一个喜欢的名字</text>
      <text class="hero-subtitle">收藏心仪的候选名，从读音、含义和喜欢的风格慢慢挑选。</text>
      <text class="disclosure">{{ NAME_DISCLOSURE }}</text>
    </view>

    <view class="filter-card">
      <view class="filter-row">
        <label for="surname" class="filter-label">姓氏</label>
        <input id="surname" v-model="filters.surname" class="filter-input" maxlength="4" placeholder="请输入姓氏（可留空）" @confirm="reload" />
      </view>
      <view class="filter-row">
        <text class="filter-label">性别偏好</text>
        <picker :range="genderOptions" range-key="label" @change="onGenderChange">
          <view class="picker-value">{{ selectedGenderLabel }}</view>
        </picker>
        <view class="length-switch">
          <button
            v-for="length in [2, 1]"
            :key="length"
            class="length-option"
            :class="{ active: filters.nameLength === length }"
            @tap="setNameLength(length)"
          >
            <text>{{ length === 2 ? '双字名' : '单字名' }}</text>
          </button>
        </view>
      </view>
      <view class="filter-row filter-row--last">
        <label for="avoid" class="filter-label">避讳字</label>
        <input id="avoid" v-model="filters.avoid" class="filter-input" maxlength="30" placeholder="如：安、宁（可不填）" @confirm="reload" />
      </view>
      <view class="filter-actions">
        <text class="filter-note">字数不含姓氏；性别偏好仅为风格标签。读音仅标注名字部分。</text>
        <button class="search-button" :loading="loading" @tap="reload">筛选</button>
      </view>
    </view>

    <view id="name-comparison"><NameComparisonPanel :selected="comparisonNames" @remove="toggleComparison" @busy="comparisonBusy = $event" /></view>

    <view class="result-head">
      <view>
        <text class="result-title">{{ favoritesOnly ? '本机收藏' : '候选名字' }}</text>
        <text class="result-count">{{ favoritesOnly ? `${favorites.length} 个` : loaded ? `共 ${total} 个` : '加载中' }}</text>
      </view>
      <button class="view-toggle" @tap="favoritesOnly = !favoritesOnly">{{ favoritesOnly ? '返回结果' : `收藏 (${favorites.length})` }}</button>
    </view>

    <text v-if="favoritesOnly" class="filter-note">收藏保存在这台设备上。复制候选名后可自行发给家人讨论。</text>
    <view v-if="!favoritesOnly && errorMessage" class="state-card state-card--error">
      <text>{{ errorMessage }}</text>
      <button class="view-toggle" @tap="retry">重试</button>
    </view>
    <view v-if="!favoritesOnly && loading && !names.length" class="state-card"><text>正在加载名字资料…</text></view>
    <view v-else-if="!visibleNames.length && (favoritesOnly || (!loading && !errorMessage))" class="state-card">
      <text>{{ favoritesOnly ? '还没有收藏，点击名字下方的收藏按钮即可保存。' : '没有符合条件的名字，试试减少避讳字或放宽偏好。' }}</text>
    </view>
    <view class="name-list">
      <view v-for="item in visibleNames" :key="nameFavoriteKey(item)" class="name-card">
        <view class="name-card-main">
          <text class="full-name">{{ item.fullName }}</text>
          <text class="name-pinyin">{{ item.pinyin }}</text>
        </view>
        <view class="name-tags">
          <text class="name-tag">{{ genderLabel(item.gender) }}</text>
          <text class="name-tag">待人工复核</text>
        </view>
        <text class="name-meaning">{{ item.meaning }}</text>
        <text class="name-source">参考：{{ item.source }}</text>
        <text v-if="item.sourceQuote" class="name-source">原句：{{ item.sourceQuote }}</text>
        <view class="card-actions">
          <button class="view-toggle" @tap="toggleFavorite(item)">{{ isFavorite(item) ? '取消收藏' : '收藏' }}</button>
          <button class="view-toggle" :class="{ 'comparison-selected': isComparing(item) }" :disabled="comparisonBusy" @tap="toggleComparison(item)">{{ isComparing(item) ? '✓ 已选对比' : '加入对比' }}</button>
          <button class="view-toggle" @tap="copyName(item)">复制候选名</button>
        </view>
      </view>
      <button v-if="!favoritesOnly && hasMore" class="load-more" :disabled="loading" @tap="loadMore">{{ loading ? '加载中…' : '加载更多' }}</button>
    </view>
    <view v-if="comparisonNames.length" class="comparison-bar"><text>已选 {{ comparisonNames.length }} 个候选名</text><button @tap="showComparison">去对比 ↑</button></view>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch, onUnmounted } from 'vue'
import { onLoad, onReachBottom, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { nameLibraryApi, type NameGender, type NameLibraryItem } from '@/api/modules'
import { NAME_LIBRARY_CLOUD_ENABLED } from '@/config/features'
import { filterNameLibrary } from '../../../../src/services/name-library.service'
import { trackMiniEvent } from '@/utils/analytics'
import { MAX_NAME_FAVORITES, NAME_DISCLOSURE, NAME_FAVORITES_KEY, nameCopyText, nameFavoriteKey, readNameFavorites } from '../../../../shared/utils/name-library'
import { NAME_COMPARISON_DRAFT_KEY } from '../../../../shared/utils/name-evaluation'
import { NAME_LIBRARY } from '../../../../src/data/name-library'
import NameComparisonPanel from '@/components/tools/NameComparisonPanel.vue'

const genderOptions: Array<{ label: string; value: NameGender | 'all' }> = [
  { label: '不限性别', value: 'all' },
  { label: '女孩', value: 'girl' },
  { label: '男孩', value: 'boy' },
  { label: '中性', value: 'neutral' },
]

const filters = reactive<{ surname: string; gender: NameGender | 'all'; nameLength: 1 | 2; avoid: string }>({
  surname: '', gender: 'all', nameLength: 2, avoid: '',
})
const names = ref<NameLibraryItem[]>([])
const favorites = ref<NameLibraryItem[]>([])
const comparisonNames = ref<NameLibraryItem[]>([])
const comparisonBusy = ref(false)
const favoritesOnly = ref(false)
const visibleNames = computed(() => favoritesOnly.value ? favorites.value : names.value)
const loading = ref(false)
const loaded = ref(false)
const errorMessage = ref('')
const page = ref(0)
const total = ref(0)
const totalPages = ref(0)
let requestId = 0
let failedAppend = false
let appliedFilters = { ...filters }

const selectedGenderLabel = computed(() => genderOptions.find(option => option.value === filters.gender)?.label || '不限性别')
const hasMore = computed(() => page.value < totalPages.value)

const genderLabel = (gender: NameGender) => ({ boy: '男孩', girl: '女孩', neutral: '中性' }[gender])

const fetchNames = async (append = false) => {
  const currentRequest = ++requestId
  const nextPage = append ? page.value + 1 : 1
  loading.value = true
  errorMessage.value = ''
  try {
    const params = { ...appliedFilters, page: nextPage, pageSize: 12 }
    const response = NAME_LIBRARY_CLOUD_ENABLED ? await nameLibraryApi.getNames(params) : filterNameLibrary(params)
    if (currentRequest !== requestId) return
    names.value = append ? names.value.concat(response.list) : response.list
    page.value = nextPage
    loaded.value = true
    total.value = response.pagination.total
    totalPages.value = response.pagination.totalPages
  } catch (error) {
    if (currentRequest !== requestId) return
    failedAppend = append
    errorMessage.value = error instanceof Error ? error.message : '名字资料加载失败'
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

const reload = () => {
  appliedFilters = { ...filters }
  favoritesOnly.value = false
  names.value = []
  loaded.value = false
  page.value = 0
  totalPages.value = 0
  trackMiniEvent('app_name_library_filter', { page: 'NameLibrary', properties: { gender: filters.gender, nameLength: filters.nameLength, hasAvoid: Boolean(filters.avoid.trim()) } })
  void fetchNames()
}

const retry = () => { if (!loading.value) void fetchNames(failedAppend) }
const setNameLength = (length: number) => { filters.nameLength = length === 1 ? 1 : 2; reload() }

const loadMore = () => {
  if (loading.value || !hasMore.value || favoritesOnly.value) return
  void fetchNames(true)
}

const onGenderChange = (event: { detail: { value: string } }) => {
  filters.gender = genderOptions[Number(event.detail.value)]?.value || 'all'
  reload()
}

const isFavorite = (item: NameLibraryItem) => favorites.value.some(saved => nameFavoriteKey(saved) === nameFavoriteKey(item))
const isComparing = (item: NameLibraryItem) => comparisonNames.value.some(saved => nameFavoriteKey(saved) === nameFavoriteKey(item))
const surnameOf = (item: NameLibraryItem) => item.fullName.endsWith(item.givenName) ? item.fullName.slice(0, -item.givenName.length) : null
const toggleComparison = (item: NameLibraryItem) => {
  if (comparisonBusy.value) return
  if (isComparing(item)) { comparisonNames.value = comparisonNames.value.filter(saved => nameFavoriteKey(saved) !== nameFavoriteKey(item)); return }
  if (comparisonNames.value.length >= 5) { uni.showToast({ title: '最多对比 5 个名字，请先移除一个', icon: 'none' }); return }
  const surname = surnameOf(item)
  if (surname === null || !/^[\p{Script=Han}]{0,4}$/u.test(surname)) { uni.showToast({ title: '请填写汉字姓氏后重新筛选', icon: 'none' }); return }
  if (comparisonNames.value.length && surnameOf(comparisonNames.value[0]) !== surname) { uni.showToast({ title: '请先移除已选名字，再比较其他姓氏', icon: 'none' }); return }
  comparisonNames.value = [...comparisonNames.value, item]
}
const showComparison = () => uni.pageScrollTo({ selector: '#name-comparison', duration: 250 })
watch(comparisonNames, value => {
  try { uni.setStorageSync(NAME_COMPARISON_DRAFT_KEY, value) }
  catch { uni.showToast({ title: '未能保存已选名字，重新进入需再选择', icon: 'none' }) }
})
const toggleFavorite = (item: NameLibraryItem) => {
  if (!isFavorite(item) && favorites.value.length >= MAX_NAME_FAVORITES) {
    uni.showToast({ title: '最多收藏 100 个名字，请先移除一些', icon: 'none' })
    return
  }
  const next = isFavorite(item) ? favorites.value.filter(saved => nameFavoriteKey(saved) !== nameFavoriteKey(item)) : [...favorites.value, item]
  try {
    uni.setStorageSync(NAME_FAVORITES_KEY, next)
    favorites.value = next
    trackMiniEvent('app_name_library_favorite', { page: 'NameLibrary', properties: { action: isFavorite(item) ? 'remove' : 'add', gender: item.gender, nameLength: Array.from(item.givenName).length } })
  } catch { uni.showToast({ title: '本机存储失败，请重试', icon: 'none' }) }
}
const copyName = (item: NameLibraryItem) => uni.setClipboardData({
  data: nameCopyText(item),
  success: () => trackMiniEvent('app_name_library_copy', { page: 'NameLibrary', properties: { gender: item.gender, nameLength: Array.from(item.givenName).length } }),
  fail: () => uni.showToast({ title: '复制失败，请重试', icon: 'none' }),
})

onLoad(() => {
  try { favorites.value = readNameFavorites(uni.getStorageSync(NAME_FAVORITES_KEY)) } catch { favorites.value = [] }
  try {
    const draft = readNameFavorites(uni.getStorageSync(NAME_COMPARISON_DRAFT_KEY)).filter(item => {
      const surname = surnameOf(item)
      return surname !== null && /^[\p{Script=Han}]{0,4}$/u.test(surname) && NAME_LIBRARY.some(candidate => candidate.id === item.id && candidate.givenName === item.givenName)
    }).slice(0, 5)
    comparisonNames.value = draft.filter(item => surnameOf(item) === surnameOf(draft[0]))
  } catch { comparisonNames.value = [] }
  void fetchNames()
  trackMiniEvent('app_name_library_open', { page: 'NameLibrary' })
})
onUnmounted(() => { requestId += 1 })
onReachBottom(loadMore)
onShareAppMessage(() => {
  trackMiniEvent('app_name_library_share', { page: 'NameLibrary', properties: { channel: 'app_message' } })
  return { title: '贝护妈妈 · 宝宝起名', path: '/pages/name-library/index' }
})
onShareTimeline(() => {
  trackMiniEvent('app_name_library_share', { page: 'NameLibrary', properties: { channel: 'timeline' } })
  return { title: '贝护妈妈 · 宝宝起名' }
})
</script>

<style scoped>
.name-page { min-height: 100vh; padding: 34rpx 28rpx calc(160rpx + env(safe-area-inset-bottom)); background: linear-gradient(180deg, #fff7f0, #fcf9f8 42%); box-sizing: border-box; }
button { margin: 0; line-height: 1.5; }
button::after { border: none; }
.disclosure { display: block; margin-top: 18rpx; padding: 16rpx; border-radius: 12rpx; background: #f5e9df; color: #725343; font-size: 24rpx; line-height: 1.6; }
.view-toggle { padding: 12rpx 16rpx; color: #8a4d32; background: #fbefe8; font-size: 24rpx; }
.card-actions { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 20rpx; }
.comparison-selected { color: #fff; background: #b76d4d; }
.comparison-bar { position: fixed; z-index: 10; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: space-between; padding: 16rpx 28rpx calc(16rpx + env(safe-area-inset-bottom)); background: #fffaf6; border-top: 1rpx solid #ead9cc; color: #6e5a50; font-size: 25rpx; }
.comparison-bar button { padding: 18rpx 32rpx; border-radius: 999rpx; color: #fff; background: #b76d4d; font-size: 25rpx; font-weight: 700; }
.name-hero { padding: 16rpx 4rpx 28rpx; }
.hero-badge { display: inline-block; padding: 8rpx 16rpx; border-radius: 999rpx; background: #f5dfd0; color: #a46046; font-size: 22rpx; font-weight: 700; }
.hero-title { display: block; margin-top: 20rpx; color: #46312a; font-size: 46rpx; line-height: 1.35; font-weight: 900; }
.hero-subtitle { display: block; margin-top: 14rpx; color: #79665b; font-size: 25rpx; line-height: 1.65; }
.filter-card { padding: 12rpx 24rpx 24rpx; border: 1rpx solid rgba(185, 119, 87, .16); border-radius: 28rpx; background: rgba(255, 255, 255, .9); box-shadow: 0 16rpx 40rpx rgba(122, 86, 64, .08); }
.filter-row { display: flex; align-items: center; flex-wrap: wrap; gap: 18rpx; min-height: 88rpx; border-bottom: 1rpx solid #f2ebe6; }
.filter-row--last { border-bottom: 0; }
.filter-label { flex-shrink: 0; width: 112rpx; color: #6e5a50; font-size: 26rpx; font-weight: 700; }
.filter-input, .picker-value { flex: 1; min-width: 0; color: #43352e; font-size: 27rpx; }
.picker-value { padding: 22rpx 0; }
.length-switch { display: flex; gap: 10rpx; }
.length-option { padding: 10rpx 14rpx; border-radius: 999rpx; background: #f7f1ed; color: #8d7a70; font-size: 22rpx; }
.length-option.active { background: #f2d3bf; color: #965338; font-weight: 700; }
.filter-actions { display: flex; align-items: center; gap: 16rpx; padding-top: 18rpx; }
.filter-note { flex: 1; color: #766359; font-size: 22rpx; line-height: 1.5; }
.search-button { flex-shrink: 0; padding: 18rpx 28rpx; border-radius: 999rpx; background: #b76d4d; color: #fff; font-size: 25rpx; font-weight: 800; }
.result-head { display: flex; align-items: end; justify-content: space-between; gap: 16rpx; padding: 34rpx 4rpx 18rpx; }
.result-title { color: #46312a; font-size: 32rpx; font-weight: 900; }
.result-count, .result-version { margin-left: 12rpx; color: #9a877c; font-size: 21rpx; }
.result-version { margin-left: 0; }
.name-list { display: flex; flex-direction: column; gap: 16rpx; }
.name-card, .state-card { padding: 24rpx; border-radius: 24rpx; background: #fff; box-shadow: 0 10rpx 28rpx rgba(96, 70, 54, .06); }
.name-card-main { display: flex; align-items: baseline; gap: 18rpx; }
.full-name { color: #3f2e28; font-size: 42rpx; font-weight: 900; letter-spacing: 3rpx; }
.name-pinyin { color: #a77964; font-size: 23rpx; }
.name-tags { display: flex; gap: 10rpx; margin-top: 12rpx; }
.name-tag { padding: 6rpx 12rpx; border-radius: 999rpx; background: #fbefe8; color: #a76b50; font-size: 20rpx; }
.name-meaning { display: block; margin-top: 18rpx; color: #5f5048; font-size: 26rpx; line-height: 1.55; }
.name-source { display: block; margin-top: 10rpx; color: #79665b; font-size: 23rpx; line-height: 1.6; }
.state-card { margin-top: 12rpx; color: #8b786e; font-size: 25rpx; line-height: 1.6; text-align: center; }
.state-card--error { color: #ad684e; }
.load-more { padding: 26rpx; color: #a76b50; font-size: 24rpx; text-align: center; }
</style>
