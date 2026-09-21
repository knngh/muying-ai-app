import type { ToolId } from '@/data/tool-catalog'

export type ToolRecordPayload = Record<string, string | number | boolean | null | undefined>

export interface LocalToolRecord {
  id: string
  toolId: ToolId
  recordType: string
  createdAt: string
  updatedAt: string
  syncStatus: 'local' | 'synced'
  payload: ToolRecordPayload
}

const STORAGE_KEY = 'beihu:tool-records:v1'

function createRecordId(): string {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function isRecord(value: unknown): value is LocalToolRecord {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<LocalToolRecord>
  return typeof item.id === 'string'
    && typeof item.toolId === 'string'
    && typeof item.recordType === 'string'
    && typeof item.createdAt === 'string'
    && typeof item.updatedAt === 'string'
    && (item.syncStatus === 'local' || item.syncStatus === 'synced')
    && !!item.payload && typeof item.payload === 'object'
}

export function readToolRecords(): LocalToolRecord[] {
  try {
    const stored = uni.getStorageSync(STORAGE_KEY)
    return Array.isArray(stored) ? stored.filter(isRecord) : []
  } catch {
    return []
  }
}

export function saveToolRecord(toolId: ToolId, recordType: string, payload: ToolRecordPayload): LocalToolRecord {
  const now = new Date().toISOString()
  const record: LocalToolRecord = {
    id: createRecordId(), toolId, recordType, createdAt: now, updatedAt: now, syncStatus: 'local', payload,
  }
  const next = [record, ...readToolRecords()].slice(0, 500)
  uni.setStorageSync(STORAGE_KEY, next)
  return record
}

export function updateToolRecord(id: string, patch: Partial<Pick<LocalToolRecord, 'payload' | 'updatedAt' | 'syncStatus'>>): LocalToolRecord | null {
  const records = readToolRecords()
  const index = records.findIndex(item => item.id === id)
  if (index < 0) return null
  const updated = { ...records[index], ...patch, updatedAt: patch.updatedAt || new Date().toISOString() }
  records[index] = updated
  uni.setStorageSync(STORAGE_KEY, records)
  return updated
}

export function importToolRecord(
  toolId: ToolId,
  recordType: string,
  serverId: string,
  payload: ToolRecordPayload,
  createdAt?: string,
  updatedAt?: string,
): LocalToolRecord {
  const records = readToolRecords()
  const existingIndex = records.findIndex(item => item.payload.serverId === serverId || item.id === `server-${serverId}`)
  const imported: LocalToolRecord = {
    id: existingIndex >= 0 ? records[existingIndex].id : `server-${serverId}`,
    toolId,
    recordType,
    createdAt: createdAt || new Date().toISOString(),
    updatedAt: updatedAt || createdAt || new Date().toISOString(),
    syncStatus: 'synced',
    payload: { ...payload, serverId },
  }
  if (existingIndex >= 0) records[existingIndex] = imported
  else records.unshift(imported)
  uni.setStorageSync(STORAGE_KEY, records.slice(0, 500))
  return imported
}

export function deleteToolRecord(id: string): void {
  uni.setStorageSync(STORAGE_KEY, readToolRecords().filter(item => item.id !== id))
}

export function listToolRecords(toolId: ToolId, recordType?: string): LocalToolRecord[] {
  return readToolRecords().filter(item => item.toolId === toolId && (!recordType || item.recordType === recordType))
}
