export interface ReportDraft {
  id: string
  name: string
  reportDate: string
  note: string
  imagePath: string
  createdAt: string
}
const prefix = 'beihu:report-drafts:v1:'
export function reportOwner(): string {
  const user = uni.getStorageSync('user')
  return uni.getStorageSync('token') && /^\d+$/.test(String(user?.id)) ? String(user.id) : 'guest'
}
export function newReportOperationId(): string {
  return `report-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}
export function readReportDrafts(owner: string): ReportDraft[] {
  const value: unknown = uni.getStorageSync(prefix + owner)
  if (!Array.isArray(value)) return []
  return value.filter((item): item is ReportDraft => !!item && typeof item.id === 'string'
    && typeof item.name === 'string' && typeof item.note === 'string' && typeof item.reportDate === 'string'
    && typeof item.imagePath === 'string' && typeof item.createdAt === 'string')
}
export function writeReportDraft(owner: string, draft: ReportDraft) {
  const records = readReportDrafts(owner).filter(item => item.id !== draft.id)
  if (records.length >= 100) throw new Error('本机草稿已满，请先归档或删除旧草稿')
  uni.setStorageSync(prefix + owner, [draft, ...records])
}
export function forgetReportDraft(owner: string, id: string) {
  uni.setStorageSync(prefix + owner, readReportDrafts(owner).filter(item => item.id !== id))
}
export function keepReportImage(tempFilePath: string): Promise<string> {
  return new Promise((resolve, reject) => uni.saveFile({ tempFilePath, success: result => resolve(result.savedFilePath), fail: () => reject(new Error('照片未能保存到本机，请腾出空间后重试')) }))
}
export function removeReportImage(filePath: string): Promise<void> {
  if (!filePath) return Promise.resolve()
  return new Promise(resolve => uni.removeSavedFile({ filePath, complete: () => resolve() }))
}
