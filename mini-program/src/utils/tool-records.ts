import type { ToolId } from '@/data/tool-catalog'
import { reportOwner } from './report-drafts'

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

const LEGACY_STORAGE_KEY = 'beihu:tool-records:v1'
const STORAGE_PREFIX = 'beihu:tool-records:v2:'
export const MAX_TOOL_RECORDS = 500

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

function ownerStorageKey(owner: string): string {
  return `${STORAGE_PREFIX}${owner}`
}

function currentOwner(): string {
  try { return reportOwner() } catch { return 'guest' }
}

function normalizeRecords(value: unknown): LocalToolRecord[] {
  return Array.isArray(value)
    ? value.filter(isRecord).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, MAX_TOOL_RECORDS)
    : []
}

function readStored(key: string): LocalToolRecord[] | undefined {
  try {
    const stored = uni.getStorageSync(key)
    return stored === undefined || stored === null ? undefined : normalizeRecords(stored)
  } catch {
    return undefined
  }
}

export function readToolRecords(): LocalToolRecord[] {
  const owner = currentOwner()
  const stored = readStored(ownerStorageKey(owner))
  if (stored !== undefined) return stored

  // Records written before v2 were device-wide. Keep them visible only to the
  // guest namespace; never silently assign them to a newly logged-in account.
  if (owner === 'guest') {
    const legacy = readStored(LEGACY_STORAGE_KEY)
    if (legacy !== undefined) {
      try { uni.setStorageSync(ownerStorageKey('guest'), legacy) } catch { /* keep the in-memory result */ }
      return legacy
    }
  }
  return []
}

export function saveToolRecord(toolId: ToolId, recordType: string, payload: ToolRecordPayload): LocalToolRecord {
  const now = new Date().toISOString()
  const record: LocalToolRecord = {
    id: createRecordId(), toolId, recordType, createdAt: now, updatedAt: now, syncStatus: 'local', payload,
  }
  const next = [record, ...readToolRecords()].slice(0, MAX_TOOL_RECORDS)
  uni.setStorageSync(ownerStorageKey(currentOwner()), next)
  return record
}

export function updateToolRecord(id: string, patch: Partial<Pick<LocalToolRecord, 'payload' | 'updatedAt' | 'syncStatus'>>): LocalToolRecord | null {
  const records = readToolRecords()
  const index = records.findIndex(item => item.id === id)
  if (index < 0) return null
  const updated = { ...records[index], ...patch, updatedAt: patch.updatedAt || new Date().toISOString() }
  records[index] = updated
  uni.setStorageSync(ownerStorageKey(currentOwner()), records.slice(0, MAX_TOOL_RECORDS))
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
  const existingIndex = records.findIndex(item => item.toolId === toolId && (item.payload.serverId === serverId || item.id === `server-${toolId}-${serverId}` || item.id === `server-${serverId}`))
  const imported: LocalToolRecord = {
    id: existingIndex >= 0 ? records[existingIndex].id : `server-${toolId}-${serverId}`,
    toolId,
    recordType,
    createdAt: createdAt || new Date().toISOString(),
    updatedAt: updatedAt || createdAt || new Date().toISOString(),
    syncStatus: 'synced',
    payload: { ...payload, serverId },
  }
  if (existingIndex >= 0) records[existingIndex] = imported
  else records.unshift(imported)
  uni.setStorageSync(ownerStorageKey(currentOwner()), records.slice(0, MAX_TOOL_RECORDS))
  return imported
}

export function deleteToolRecord(id: string): void {
  uni.setStorageSync(ownerStorageKey(currentOwner()), readToolRecords().filter(item => item.id !== id))
}

export function listToolRecords(toolId: ToolId, recordType?: string): LocalToolRecord[] {
  return readToolRecords().filter(item => item.toolId === toolId && (!recordType || item.recordType === recordType))
}
