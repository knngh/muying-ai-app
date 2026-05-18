<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { useAppStore } from '@/stores/app'
import { clearLocalSession, isStoredAuthTokenUsable } from '@/utils'
import { trackMiniEvent } from '@/utils/analytics'
import { inferAcquisitionEntrySource, recordAcquisitionContext } from '@/utils/acquisition'

let lastAcquisitionLaunchSignature = ''

function getLaunchQuery(options: unknown): Record<string, unknown> | null {
  if (!options || typeof options !== 'object') {
    return null
  }

  const query = (options as { query?: unknown }).query
  return query && typeof query === 'object' ? query as Record<string, unknown> : null
}

function getLaunchPath(options: unknown): string | null {
  if (!options || typeof options !== 'object') {
    return null
  }

  const path = (options as { path?: unknown }).path
  return typeof path === 'string' && path.trim() ? path.trim() : null
}

function trackAcquisitionLaunch(options: unknown) {
  const context = recordAcquisitionContext(getLaunchQuery(options))
  if (!context) {
    return
  }

  const entryPath = getLaunchPath(options)
  const entrySource = context.entrySource || inferAcquisitionEntrySource(entryPath)
  const signature = [
    entryPath || '',
    context.channel || '',
    context.campaign || '',
    context.scene || '',
    entrySource || '',
  ].join('|')

  if (signature === lastAcquisitionLaunchSignature) {
    return
  }

  lastAcquisitionLaunchSignature = signature
  trackMiniEvent('mini_program_app_download_click', {
    page: entryPath || 'AppLaunch',
    properties: {
      entryPath,
      entrySource,
    },
  })
}

onLaunch((options) => {
  trackAcquisitionLaunch(options)

  const token = uni.getStorageSync('token')
  if (!token) {
    return
  }

  if (!isStoredAuthTokenUsable(token)) {
    clearLocalSession()
    return
  }

  const appStore = useAppStore()
  appStore.fetchUser()
})
</script>

<style>
page {
  background-color: #fcf9f8;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 28rpx;
  color: #444;
}

.container {
  padding: 24rpx;
}

.card {
  background: #fffcf8;
  border-radius: 24rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(31, 42, 55, 0.02);
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

.text-primary { color: #16806a; }
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
  background-color: #16806a;
  color: #fff;
  border-radius: 16rpx;
  padding: 16rpx 32rpx;
  text-align: center;
  font-size: 28rpx;
}

.btn-default {
  background-color: #fffcf8;
  color: #444;
  border: 2rpx solid #d9d9d9;
  border-radius: 16rpx;
  padding: 16rpx 32rpx;
  text-align: center;
  font-size: 28rpx;
}

.btn-danger {
  background-color: #ff4d4f;
  color: #fff;
  border-radius: 16rpx;
  padding: 16rpx 32rpx;
  text-align: center;
  font-size: 28rpx;
}

.tag {
  display: inline-block;
  padding: 4rpx 16rpx;
  border-radius: 12rpx;
  font-size: 22rpx;
  margin-right: 12rpx;
  margin-bottom: 8rpx;
}

.tag-blue { background: #e6f7ff; color: #16806a; }
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
