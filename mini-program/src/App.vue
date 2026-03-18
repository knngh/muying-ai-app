<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { useAppStore } from '@/stores/app'

onLaunch(() => {
  // 检查 token，如果存在则获取用户信息
  const token = uni.getStorageSync('token')
  if (token) {
    const appStore = useAppStore()
    appStore.fetchUser()
  }
})
</script>

<style>
page {
  background-color: #f5f5f5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 28rpx;
  color: #333;
}

.container {
  padding: 24rpx;
}

.card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.flex-row {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.flex-col {
  display: flex;
  flex-direction: column;
}

.flex-1 {
  flex: 1;
}

.gap-sm { gap: 12rpx; }
.gap-md { gap: 24rpx; }

.text-primary { color: #1890ff; }
.text-secondary { color: #999; }
.text-danger { color: #ff4d4f; }
.text-success { color: #52c41a; }

.text-center { text-align: center; }
.text-bold { font-weight: bold; }

.title-1 { font-size: 44rpx; font-weight: bold; }
.title-2 { font-size: 36rpx; font-weight: bold; }
.title-3 { font-size: 32rpx; font-weight: bold; }
.title-4 { font-size: 28rpx; font-weight: bold; }

.btn-primary {
  background-color: #1890ff;
  color: #fff;
  border-radius: 8rpx;
  padding: 16rpx 32rpx;
  text-align: center;
  font-size: 28rpx;
}

.btn-default {
  background-color: #fff;
  color: #333;
  border: 2rpx solid #d9d9d9;
  border-radius: 8rpx;
  padding: 16rpx 32rpx;
  text-align: center;
  font-size: 28rpx;
}

.btn-danger {
  background-color: #ff4d4f;
  color: #fff;
  border-radius: 8rpx;
  padding: 16rpx 32rpx;
  text-align: center;
  font-size: 28rpx;
}

.tag {
  display: inline-block;
  padding: 4rpx 16rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
  margin-right: 12rpx;
  margin-bottom: 8rpx;
}

.tag-blue { background: #e6f7ff; color: #1890ff; }
.tag-pink { background: #fff0f6; color: #eb2f96; }
.tag-green { background: #f6ffed; color: #52c41a; }
.tag-orange { background: #fff7e6; color: #fa8c16; }
.tag-purple { background: #f9f0ff; color: #722ed1; }
.tag-red { background: #fff1f0; color: #ff4d4f; }
.tag-default { background: #f0f0f0; color: #666; }

.divider {
  height: 2rpx;
  background: #f0f0f0;
  margin: 24rpx 0;
}

.empty-state {
  padding: 80rpx 0;
  text-align: center;
  color: #999;
}
</style>
