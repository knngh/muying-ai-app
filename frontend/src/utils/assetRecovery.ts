const RELOAD_AT_KEY = 'beihu:asset-reload-at'
const RELOAD_INTERVAL_MS = 60_000

/** Recover a removed route chunk after a deployment without creating reload loops. */
export function installAssetRecovery() {
  window.addEventListener('vite:preloadError', event => {
    const now = Date.now()
    try {
      const previous = Number(window.sessionStorage.getItem(RELOAD_AT_KEY))
      if (previous > 0 && now - previous < RELOAD_INTERVAL_MS) return
      window.sessionStorage.setItem(RELOAD_AT_KEY, String(now))
    } catch {
      // Without a persistent retry marker, retain the normal manual recovery UI.
      return
    }
    event.preventDefault()
    window.location.reload()
  })
}
