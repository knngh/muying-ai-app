import { ref } from 'vue'

export const isOffline = ref(false)

let initialized = false

export function initNetworkMonitor() {
  if (initialized) return
  initialized = true

  // 初始状态
  uni.getNetworkType({
    success: (res) => {
      isOffline.value = res.networkType === 'none'
    },
  })

  // 监听网络变化
  uni.onNetworkStatusChange((res) => {
    const wasOffline = isOffline.value
    isOffline.value = !res.isConnected

    if (wasOffline && res.isConnected) {
      uni.showToast({ title: '网络已恢复', icon: 'none', duration: 1500 })
    } else if (!wasOffline && !res.isConnected) {
      uni.showToast({ title: '网络已断开', icon: 'none', duration: 2000 })
    }
  })
}
