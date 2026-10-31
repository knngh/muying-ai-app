// WeChat requires the agreePrivacyAuthorization button event before privacy APIs.
// https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/PrivacyAuthorize.html
export async function ensurePhotoPrivacy(requestConsent: () => Promise<boolean>): Promise<boolean> {
  const privacyApi = (uni as unknown as {
    getPrivacySetting?: (options: { success: (result: { needAuthorization?: boolean }) => void; fail: () => void }) => void
  }).getPrivacySetting
  if (typeof privacyApi !== 'function') return true
  try {
    const required = await new Promise<boolean | null>(resolve => privacyApi.call(uni, {
      success: result => resolve(result.needAuthorization === true),
      fail: () => resolve(null),
    }))
    if (required === null) return false
    return required ? await requestConsent() : true
  } catch { return false }
}
