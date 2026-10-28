import { onBeforeUnmount, ref } from 'vue'

// WeChat requires the agreement button event before declared privacy APIs continue.
// https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/PrivacyAuthorize.html
interface PrivacyApi {
  getPrivacySetting?: (options: {
    success: (result: { needAuthorization?: boolean }) => void
    fail: () => void
  }) => void
  openPrivacyContract?: (options: { fail: () => void }) => void
}

export function useMiniProgramPrivacyAuthorization() {
  const visible = ref(false)
  let resolvePending: ((allowed: boolean) => void) | null = null
  const privacyApi = uni as unknown as PrivacyApi

  const finish = (allowed: boolean) => {
    visible.value = false
    const resolve = resolvePending
    resolvePending = null
    resolve?.(allowed)
  }

  const ensurePrivacyAuthorization = (): Promise<boolean> => {
    if (resolvePending) return Promise.resolve(false)
    if (typeof privacyApi.getPrivacySetting !== 'function') return Promise.resolve(true)

    return new Promise(resolve => {
      resolvePending = resolve
      try {
        privacyApi.getPrivacySetting?.({
          success: result => {
            if (result?.needAuthorization) {
              visible.value = true
              return
            }
            finish(true)
          },
          fail: () => {
            finish(false)
            uni.showToast({ title: '暂时无法确认隐私授权，请稍后重试', icon: 'none' })
          },
        })
      } catch {
        finish(false)
        uni.showToast({ title: '暂时无法确认隐私授权，请稍后重试', icon: 'none' })
      }
    })
  }

  const agreePrivacyAuthorization = () => finish(true)
  const rejectPrivacyAuthorization = () => finish(false)
  const openPrivacyContract = () => {
    finish(false)
    if (typeof privacyApi.openPrivacyContract === 'function') {
      privacyApi.openPrivacyContract({ fail: () => uni.navigateTo({ url: '/pages/privacy-policy/index' }) })
      return
    }
    uni.navigateTo({ url: '/pages/privacy-policy/index' })
  }

  onBeforeUnmount(() => finish(false))
  return { visible, ensurePrivacyAuthorization, agreePrivacyAuthorization, rejectPrivacyAuthorization, openPrivacyContract }
}
