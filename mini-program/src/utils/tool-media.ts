import { readToolRecords, saveToolRecord, type ToolRecordPayload } from './tool-records'
export function keepToolImage(tempFilePath: string): Promise<string> {
  return new Promise((resolve, reject) => uni.saveFile({ tempFilePath, success: result => resolve(result.savedFilePath), fail: () => reject(new Error('图片未能保存到本机，请检查剩余空间后重试')) }))
}
export function removeUnusedToolImage(filePath: string): Promise<void> {
  if (!filePath || readToolRecords().some(record => record.payload.path === filePath)) return Promise.resolve()
  return new Promise(resolve => uni.removeSavedFile({ filePath, complete: () => resolve() }))
}
export async function saveToolImage(toolId: 'album' | 'poster', path: string, payload: ToolRecordPayload) {
  const savedPath = await keepToolImage(path)
  try { return saveToolRecord(toolId, toolId === 'album' ? 'photo' : 'card', { ...payload, path: savedPath }) }
  catch (error) { await removeUnusedToolImage(savedPath); throw error }
}
