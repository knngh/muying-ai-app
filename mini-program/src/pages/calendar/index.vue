<template>
  <view class="calendar-timeline-page">
    <!-- 顶部背景与动态宝宝展示 -->
    <view class="hero-section">
      <view class="header-nav">
        <text class="hero-title">{{ currentWeekData.title }}</text>
      </view>

      <!-- 动态宝宝成长动画区 -->
      <view class="baby-animation-container">
        <!-- 呼吸动画的光晕 -->
        <view class="breathing-glow"></view>
        <!-- 宝宝状态/大小比喻展示 -->
        <view class="baby-visual">
          <text class="baby-emoji">{{ currentWeekData.babySizeEmoji || '🌱' }}</text>
        </view>
        <view class="baby-size-info">
          <text class="size-text">相当于: {{ currentWeekData.babySizeText || '未知大小' }}</text>
          <text class="size-desc" v-if="currentWeekData.babyWeight">体重约: {{ currentWeekData.babyWeight }}</text>
        </view>
      </view>

      <!-- 横向滑动时间轴 -->
      <scroll-view 
        scroll-x 
        class="week-timeline-scroll" 
        :scroll-into-view="'week-' + currentSelectedWeek"
        scroll-with-animation
      >
        <view class="timeline-container">
          <view 
            v-for="week in weeksList" 
            :key="week.num" 
            :id="'week-' + week.num"
            class="timeline-item"
            :class="{ 'active': currentSelectedWeek === week.num }"
            :data-week="week.num"
            @tap="handleSelectWeek"
          >
            <view class="week-circle">{{ week.num }}</view>
            <text class="week-label">周</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 选项卡切换 -->
    <view class="tabs-container">
      <view 
        class="tab-item" 
        :class="{ 'active': activeTab === 'guide' }" 
        @tap="activeTab = 'guide'"
      >
        <text class="tab-text">孕周指南</text>
        <view class="tab-line" v-if="activeTab === 'guide'"></view>
      </view>
      <view 
        class="tab-item" 
        :class="{ 'active': activeTab === 'diary' }" 
        @tap="activeTab = 'diary'"
      >
        <text class="tab-text">我的记录</text>
        <view class="tab-line" v-if="activeTab === 'diary'"></view>
      </view>
    </view>

    <!-- 孕周指南 内容 -->
    <view class="content-section" v-if="activeTab === 'guide'">
      <!-- 总体总结 -->
      <view class="summary-card">
        <text class="quote-mark">“</text>
        <text class="summary-text">{{ currentWeekData.summary }}</text>
        <text class="quote-mark right">”</text>
      </view>

      <!-- 宝宝发育 -->
      <view class="info-card baby-card">
        <view class="card-header">
          <view class="header-left">
            <text class="card-icon">👶</text>
            <text class="card-title">宝宝发育</text>
          </view>
        </view>
        <view class="card-body">
          <text class="card-text">{{ parsedContent.baby }}</text>
        </view>
      </view>

      <!-- 孕妈变化 -->
      <view class="info-card mom-card">
        <view class="card-header">
          <view class="header-left">
            <text class="card-icon">👩</text>
            <text class="card-title">妈妈变化</text>
          </view>
        </view>
        <view class="card-body">
          <text class="card-text">{{ parsedContent.mom }}</text>
        </view>
      </view>

      <!-- 本周建议 Tips -->
      <view class="info-card tips-card" v-if="parsedContent.tips && parsedContent.tips.length > 0">
        <view class="card-header">
          <view class="header-left">
            <text class="card-icon">💡</text>
            <text class="card-title">本周建议</text>
          </view>
        </view>
        <view class="card-body">
          <view class="tip-item" v-for="(tip, index) in parsedContent.tips" :key="index">
            <view class="tip-dot"></view>
            <text class="tip-text">{{ tip }}</text>
          </view>
        </view>
      </view>

      <!-- 核心待办 Todo -->
      <view class="info-card todo-card" v-if="todoList.length > 0">
        <view class="card-header">
          <view class="header-left">
            <text class="card-icon">📌</text>
            <text class="card-title">核心待办</text>
          </view>
          <text class="todo-progress">{{ completedTodoCount }}/{{ todoList.length }} 完成</text>
        </view>
        <text v-if="!canUseTodoActions" class="todo-login-hint">登录后可勾选并保存待办进度</text>
        <view class="card-body">
          <view
            class="todo-item"
            :class="{
              'todo-item--done': todo.completed,
              'todo-item--disabled': !canUseTodoActions,
            }"
            v-for="todo in todoList"
            :key="todo.stateKey"
            @tap="toggleTodo(todo)"
          >
            <view class="todo-check" :class="{ 'todo-check--done': todo.completed }">
              <text class="todo-check-icon">{{ todo.completed ? '✓' : '' }}</text>
            </view>
            <view class="todo-content">
              <view class="todo-meta">
                <view class="todo-type" :class="'type-' + todo.type">{{ todo.type === 'checkup' ? '产检' : '事项' }}</view>
                <text v-if="todo.completed" class="todo-state">已完成</text>
              </view>
              <text class="todo-title">{{ todo.title }}</text>
              <text class="todo-desc">{{ todo.desc }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 我的记录 内容 -->
    <view class="content-section" v-if="activeTab === 'diary'">
      <view class="diary-empty" v-if="!currentDiary">
        <text class="empty-emoji">📝</text>
        <text class="empty-text">这周还没有记录哦，写下你的孕期感受吧！</text>
        <button class="add-diary-btn" @tap="openDiaryModal">添加本周记录</button>
      </view>

      <view class="diary-card" v-else>
        <view class="diary-header">
          <text class="diary-date">{{ currentDiary.date }}</text>
          <text class="edit-btn" @tap="openDiaryModal">编辑</text>
        </view>
        <view class="diary-content">
          <text>{{ currentDiary.content }}</text>
        </view>
      </view>
    </view>

    <!-- 浮动操作按钮 (仅在孕周指南下显示快捷记录) -->
    <view class="fab-button" v-if="activeTab === 'guide'" @tap="openDiaryModal">
      <text class="fab-icon">✏️</text>
    </view>

    <!-- 编辑记录弹窗 -->
    <view class="modal-mask" v-if="showDiaryModal" @tap="closeDiaryModal">
      <view class="modal-content" @tap.stop>
        <view class="modal-header">
          <text class="modal-title">记录 {{ currentWeekData.title }}</text>
          <text class="close-icon" @tap="closeDiaryModal">×</text>
        </view>
        <textarea 
          class="diary-textarea" 
          v-model="diaryInput" 
          placeholder="今天宝宝动了吗？有没有觉得哪里不舒服？记下来吧..." 
          :maxlength="500"
        />
        <button class="save-btn" @tap="saveDiary">保存记录</button>
      </view>
    </view>

  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import mockDataArray from './mockData.json'
import { useAppStore } from '@/stores/app'
import { calendarApi, type PregnancyTodoProgress, type PregnancyDiary } from '@/api/modules'

const weeksList = ref(Array.from({ length: 40 }, (_, i) => ({ num: i + 1 })))
const appStore = useAppStore()

const resolveInitialWeek = () => {
  const token = uni.getStorageSync('token')
  const storedWeek = Number(uni.getStorageSync('userPregnancyWeek'))

  if (!token) return 1
  if (storedWeek >= 1 && storedWeek <= 40) return storedWeek
  return 1
}

const currentSelectedWeek = ref(resolveInitialWeek())
const activeTab = ref('guide') // 'guide' | 'diary'

// 模拟日记数据库
const userDiaries = ref<Record<number, PregnancyDiary>>({})
const loginUserId = ref('')
const todoState = ref<Record<string, boolean>>({})

// 日记弹窗状态
const showDiaryModal = ref(false)
const diaryInput = ref('')

const fallbackData = {
  title: '数据未收录',
  summary: '这周的详细科普数据还在采集中，敬请期待！',
  babySizeEmoji: '✨',
  babySizeText: '不断成长中',
  babyWeight: '',
  content: { baby: '暂无数据', mom: '暂无数据', tips: [], todo: [] }
}

const currentWeekData = computed(() => {
  const found = mockDataArray.find((item: any) => item.week === currentSelectedWeek.value)
  return found || fallbackData
})

const buildTodoKey = (index: number) => `todo-${index}`
const buildTodoStateKey = (week: number, todoKey: string) => `${week}:${todoKey}`

const resolveLoginUserId = () => {
  const token = uni.getStorageSync('token')
  if (!token) return ''

  if (appStore.user?.id) {
    return String(appStore.user.id)
  }

  const storedUser = uni.getStorageSync('user')
  if (storedUser && typeof storedUser === 'object' && 'id' in storedUser && storedUser.id) {
    return String(storedUser.id)
  }

  return ''
}

const mapTodoProgressToState = (progressList: PregnancyTodoProgress[]) => {
  const nextState: Record<string, boolean> = {}
  progressList.forEach((item) => {
    if (item.completed) {
      nextState[buildTodoStateKey(item.week, item.todoKey)] = true
    }
  })
  return nextState
}

const mapDiariesToState = (diaries: PregnancyDiary[]) => {
  const nextState: Record<number, PregnancyDiary> = {}
  diaries.forEach((item) => {
    nextState[item.week] = item
  })
  return nextState
}

const syncTodoContext = async () => {
  loginUserId.value = resolveLoginUserId()
  if (!loginUserId.value) {
    todoState.value = {}
    return
  }

  try {
    const progressList = await calendarApi.getTodoProgress()
    todoState.value = mapTodoProgressToState(progressList)
  } catch (err) {
    console.error('[Calendar] 获取待办进度失败:', err)
    todoState.value = {}
  }
}

const syncDiaryContext = async () => {
  if (!loginUserId.value) {
    userDiaries.value = {}
    return
  }

  try {
    const diaries = await calendarApi.getDiaries()
    userDiaries.value = mapDiariesToState(diaries)
  } catch (err) {
    console.error('[Calendar] 获取孕周记录失败:', err)
    userDiaries.value = {}
  }
}

const parsedContent = computed(() => currentWeekData.value.content)
const currentDiary = computed(() => userDiaries.value[currentSelectedWeek.value])
const canUseTodoActions = computed(() => !!loginUserId.value)
const todoList = computed(() =>
  (parsedContent.value.todo || []).map((todo: any, index: number) => {
    const todoKey = buildTodoKey(index)
    const stateKey = buildTodoStateKey(currentSelectedWeek.value, todoKey)
    return {
      ...todo,
      todoKey,
      stateKey,
      completed: !!todoState.value[stateKey],
    }
  }),
)
const completedTodoCount = computed(() => todoList.value.filter(todo => todo.completed).length)

const handleSelectWeek = (e: any) => {
  const weekNum = e.currentTarget.dataset.week
  if (weekNum) {
    currentSelectedWeek.value = Number(weekNum)
  }
}

// 登录检查（编辑功能需要登录）
const checkLogin = (
  toastTitle = '请先登录后再记录',
  shouldRedirect = true,
): boolean => {
  const token = uni.getStorageSync('token')
  if (!token) {
    uni.showToast({ title: toastTitle, icon: 'none' })
    if (shouldRedirect) {
      setTimeout(() => {
        uni.navigateTo({ url: '/pages/login/index' })
      }, 1000)
    }
    return false
  }
  return true
}

// 弹窗与记录逻辑
const openDiaryModal = () => {
  if (!checkLogin()) return
  const existing = userDiaries.value[currentSelectedWeek.value]
  diaryInput.value = existing ? existing.content : ''
  showDiaryModal.value = true
}

const closeDiaryModal = () => {
  showDiaryModal.value = false
}

const saveDiary = () => {
  if (!checkLogin()) return

  const trimmedContent = diaryInput.value.trim()
  if (!trimmedContent) {
    uni.showToast({ title: '内容不能为空', icon: 'none' })
    return
  }

  if (trimmedContent.length > 500) {
    uni.showToast({ title: '内容不能超过500字', icon: 'none' })
    return
  }

  void (async () => {
    try {
      const savedDiary = await calendarApi.saveDiary({
        week: currentSelectedWeek.value,
        content: trimmedContent,
      })

      userDiaries.value = {
        ...userDiaries.value,
        [currentSelectedWeek.value]: savedDiary,
      }
      closeDiaryModal()
      activeTab.value = 'diary'
      uni.showToast({ title: '记录已保存', icon: 'success' })
    } catch (err: any) {
      console.error('[Calendar] 保存孕周记录失败:', err)
      uni.showToast({ title: err?.message || '保存失败，请稍后重试', icon: 'none' })
    }
  })()
}

const toggleTodo = async (todo: { todoKey: string; stateKey: string; completed: boolean }) => {
  if (!checkLogin('请先登录后使用待办', false) || !canUseTodoActions.value) return

  const nextCompleted = !todo.completed

  try {
    await calendarApi.updateTodoProgress({
      week: currentSelectedWeek.value,
      todoKey: todo.todoKey,
      completed: nextCompleted,
    })

    const nextState = { ...todoState.value }
    if (nextCompleted) {
      nextState[todo.stateKey] = true
    } else {
      delete nextState[todo.stateKey]
    }
    todoState.value = nextState
  } catch (err: any) {
    console.error('[Calendar] 保存待办进度失败:', err)
    uni.showToast({ title: err?.message || '保存失败，请稍后重试', icon: 'none' })
  }
}

onShow(() => {
  currentSelectedWeek.value = resolveInitialWeek()
  loginUserId.value = resolveLoginUserId()
  void Promise.all([syncTodoContext(), syncDiaryContext()])
})
</script>

<style scoped>
.calendar-timeline-page {
  min-height: 100vh;
  background-color: #f7f9fa;
  padding-bottom: 120rpx;
}

/* 顶部 Hero Section */
.hero-section {
  background: linear-gradient(180deg, #ffe5ec 0%, #fff0f5 60%, #f7f9fa 100%);
  padding-top: 100rpx;
  position: relative;
  overflow: hidden;
}

.header-nav {
  text-align: center;
  margin-bottom: 40rpx;
}

.hero-title {
  font-size: 44rpx;
  font-weight: 800;
  color: #333;
}

/* 宝宝动态展示区 */
.baby-animation-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300rpx;
  position: relative;
  margin-bottom: 40rpx;
}

.breathing-glow {
  position: absolute;
  width: 200rpx;
  height: 200rpx;
  background: radial-gradient(circle, rgba(255,107,157,0.3) 0%, rgba(255,255,255,0) 70%);
  border-radius: 50%;
  animation: pulse 3s infinite ease-in-out;
  z-index: 1;
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.5); opacity: 0.3; }
  100% { transform: scale(1); opacity: 0.8; }
}

.baby-visual {
  z-index: 2;
  font-size: 100rpx;
  background: #ffffff;
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 30rpx rgba(255, 107, 157, 0.2);
  animation: float 4s infinite ease-in-out;
}

@keyframes float {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
}

.baby-size-info {
  z-index: 2;
  margin-top: 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(255, 255, 255, 0.8);
  padding: 10rpx 30rpx;
  border-radius: 40rpx;
  box-shadow: 0 4rpx 10rpx rgba(0,0,0,0.02);
}

.size-text { font-size: 28rpx; color: #ff6b9d; font-weight: bold; }
.size-desc { font-size: 22rpx; color: #888; margin-top: 4rpx; }

/* 时间轴 */
.week-timeline-scroll {
  width: 100%;
  white-space: nowrap;
  padding-bottom: 20rpx;
  -webkit-overflow-scrolling: touch;
}

.timeline-container { display: inline-flex; padding: 0 30rpx; }
.timeline-item {
  display: flex; flex-direction: column; align-items: center;
  margin-right: 36rpx; opacity: 0.6; transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.timeline-item.active { opacity: 1; transform: scale(1.15) translateY(-5rpx); }

.week-circle {
  width: 70rpx; height: 70rpx; border-radius: 35rpx;
  background-color: #ffffff; color: #666; display: flex;
  justify-content: center; align-items: center; font-size: 28rpx;
  font-weight: bold; margin-bottom: 8rpx; box-shadow: 0 4rpx 10rpx rgba(0,0,0,0.05);
}
.timeline-item.active .week-circle {
  background: linear-gradient(135deg, #ff6b9d 0%, #ff9a9e 100%);
  color: #fff; box-shadow: 0 8rpx 20rpx rgba(255, 107, 157, 0.4);
}

.week-label { font-size: 22rpx; color: #999; }
.timeline-item.active .week-label { color: #ff6b9d; font-weight: bold; }

/* Tabs */
.tabs-container {
  display: flex; justify-content: space-around; background-color: #fff;
  border-radius: 40rpx 40rpx 0 0; padding: 30rpx 40rpx 0; margin-top: -20rpx;
  position: relative; z-index: 10; box-shadow: 0 -4rpx 20rpx rgba(0,0,0,0.02);
}
.tab-item { position: relative; padding-bottom: 20rpx; }
.tab-text { font-size: 32rpx; color: #888; font-weight: 500; transition: color 0.3s; }
.tab-item.active .tab-text { color: #333; font-weight: bold; }
.tab-line {
  position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);
  width: 40rpx; height: 8rpx; border-radius: 4rpx; background: #ff6b9d;
}

/* 内容区 */
.content-section { padding: 30rpx; background-color: #f7f9fa; }
.summary-card {
  background: linear-gradient(135deg, #ffffff 0%, #fff5f8 100%);
  padding: 40rpx 30rpx; border-radius: 24rpx; margin-bottom: 30rpx;
  position: relative; box-shadow: 0 4rpx 20rpx rgba(255, 107, 157, 0.1);
}
.quote-mark {
  font-size: 80rpx; color: rgba(255, 107, 157, 0.2); position: absolute;
  font-family: Georgia, serif; line-height: 1;
}
.quote-mark { left: 20rpx; top: 10rpx; }
.quote-mark.right { right: 20rpx; bottom: -20rpx; transform: rotate(180deg); }
.summary-text { font-size: 30rpx; color: #444; line-height: 1.6; text-indent: 2em; position: relative; z-index: 2; }

.info-card { background-color: #fff; border-radius: 24rpx; padding: 30rpx; margin-bottom: 30rpx; box-shadow: 0 4rpx 15rpx rgba(0,0,0,0.03); }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20rpx; }
.header-left { display: flex; align-items: center; }
.card-icon { font-size: 36rpx; margin-right: 12rpx; }
.card-title { font-size: 32rpx; font-weight: bold; color: #333; }
.card-body { font-size: 28rpx; color: #555; line-height: 1.7; }
.card-text { white-space: pre-wrap; display: block; margin-bottom: 12rpx; }
.todo-progress { font-size: 22rpx; color: #999; }
.todo-login-hint { display: block; margin-bottom: 16rpx; font-size: 24rpx; color: #8c8c8c; }

.tip-item { display: flex; margin-bottom: 12rpx; align-items: flex-start; }
.tip-dot { width: 10rpx; height: 10rpx; background-color: #ff9a9e; border-radius: 50%; margin-top: 16rpx; margin-right: 16rpx; flex-shrink: 0; }
.tip-text { flex: 1; }

.todo-item {
  display: flex; align-items: flex-start; background-color: #f8f9fa; border-radius: 16rpx; padding: 24rpx;
  margin-bottom: 16rpx; border-left: 8rpx solid transparent; transition: all 0.2s ease;
}
.todo-item:nth-child(odd) { border-left-color: #4caf50; }
.todo-item:nth-child(even) { border-left-color: #ff9800; }
.todo-item--done { background-color: #eef7f1; border-left-color: #5dbb7f !important; }
.todo-item--disabled { opacity: 0.78; }
.todo-check {
  width: 40rpx; height: 40rpx; border-radius: 20rpx; border: 2rpx solid #d7dbe2;
  background: #fff; display: flex; align-items: center; justify-content: center;
  margin-right: 20rpx; margin-top: 8rpx; flex-shrink: 0;
}
.todo-check--done { border-color: #5dbb7f; background: #5dbb7f; }
.todo-check-icon { color: #fff; font-size: 24rpx; font-weight: bold; }
.todo-content { flex: 1; }
.todo-meta { display: flex; align-items: center; gap: 12rpx; margin-bottom: 8rpx; }
.todo-type { font-size: 22rpx; padding: 4rpx 12rpx; border-radius: 8rpx; height: fit-content; white-space: nowrap; }
.type-checkup { background-color: #e8f5e9; color: #4caf50; }
.type-action { background-color: #fff3e0; color: #ff9800; }
.todo-state { font-size: 22rpx; color: #5dbb7f; }
.todo-title { display: block; font-size: 28rpx; font-weight: bold; color: #333; margin-bottom: 8rpx; }
.todo-desc { font-size: 24rpx; color: #777; }
.todo-item--done .todo-title { color: #7e8b84; text-decoration: line-through; }
.todo-item--done .todo-desc { color: #98a49d; }

.diary-empty { display: flex; flex-direction: column; align-items: center; padding: 100rpx 0; }
.empty-emoji { font-size: 80rpx; margin-bottom: 20rpx; }
.empty-text { font-size: 28rpx; color: #999; margin-bottom: 40rpx; }
.add-diary-btn { background: linear-gradient(135deg, #ff6b9d 0%, #ff9a9e 100%); color: white; border-radius: 40rpx; padding: 0 60rpx; height: 80rpx; line-height: 80rpx; font-size: 30rpx; box-shadow: 0 8rpx 20rpx rgba(255, 107, 157, 0.3); }

.diary-card { background-color: #fff; border-radius: 24rpx; padding: 40rpx; box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.04); }
.diary-header { display: flex; justify-content: space-between; margin-bottom: 20rpx; border-bottom: 2rpx dashed #eee; padding-bottom: 15rpx; }
.diary-date { font-size: 24rpx; color: #999; }
.edit-btn { font-size: 24rpx; color: #ff6b9d; }
.diary-content { font-size: 30rpx; color: #333; line-height: 1.8; }

.fab-button {
  position: fixed; bottom: 60rpx; right: 40rpx; width: 100rpx; height: 100rpx;
  background: linear-gradient(135deg, #ff6b9d 0%, #ff9a9e 100%); border-radius: 50%;
  display: flex; justify-content: center; align-items: center; box-shadow: 0 8rpx 20rpx rgba(255, 107, 157, 0.4); z-index: 100;
}
.fab-icon { font-size: 40rpx; }

.modal-mask { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 999; }
.modal-content { width: 85%; background-color: #fff; border-radius: 30rpx; padding: 40rpx; }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30rpx; }
.modal-title { font-size: 34rpx; font-weight: bold; }
.close-icon { font-size: 44rpx; color: #999; padding: 10rpx; }
.diary-textarea { width: 100%; height: 300rpx; background-color: #f7f9fa; border-radius: 16rpx; padding: 20rpx; font-size: 28rpx; box-sizing: border-box; margin-bottom: 30rpx; }
.save-btn { background: linear-gradient(135deg, #ff6b9d 0%, #ff9a9e 100%); color: white; border-radius: 40rpx; height: 80rpx; line-height: 80rpx; font-size: 32rpx; }
</style>
