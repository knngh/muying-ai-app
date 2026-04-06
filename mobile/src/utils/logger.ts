import { config } from '../config'

export function logError(scope: string, error: unknown): void {
  if (!config.enableDebugLogs) {
    return
  }

  console.error(`[${scope}]`, error)
}
