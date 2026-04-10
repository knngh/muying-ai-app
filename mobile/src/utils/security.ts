import type { ImageSourcePropType } from 'react-native'

function isPrivateIpv4(hostname: string): boolean {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!match) {
    return false
  }

  const [a, b] = match.slice(1).map(Number)
  return a === 10
    || a === 127
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 169 && b === 254)
    || a === 0
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase()
  return !normalized
    || normalized === 'localhost'
    || normalized.endsWith('.local')
    || normalized.endsWith('.internal')
    || normalized.endsWith('.lan')
    || normalized.endsWith('.home')
    || normalized === '::1'
    || normalized.startsWith('fe80:')
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || isPrivateIpv4(normalized)
}

export function getSafeRemoteImageSource(uri?: string | null): ImageSourcePropType | undefined {
  if (!uri) {
    return undefined
  }

  try {
    const parsed = new URL(uri)
    if (parsed.protocol !== 'https:') {
      return undefined
    }
    if (parsed.username || parsed.password) {
      return undefined
    }
    if (isBlockedHostname(parsed.hostname)) {
      return undefined
    }

    return { uri: parsed.toString() }
  } catch {
    return undefined
  }
}

export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/\shref\s*=\s*(['"])\s*javascript:[^'"]*\1/gi, ' href="#"')
    .replace(/\ssrc\s*=\s*(['"])\s*javascript:[^'"]*\1/gi, '')
}

export function buildSafeArticleHtml(content: string): string {
  return `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-size:16px;line-height:1.9;color:#35261E;background:#FFF9F4;padding:0;margin:0}img{max-width:100%;height:auto;border-radius:16px;margin:12px 0}a{color:#9F4E2E;text-decoration:none}p,li{color:#70554A}h1,h2,h3,h4{color:#241813;line-height:1.45}blockquote{margin:16px 0;padding:12px 16px;border-left:4px solid #D98A5D;background:#F8EBDD;border-radius:12px;color:#70554A}</style></head><body>${sanitizeHtml(content)}</body></html>`
}

export function shouldAllowWebViewNavigation(url?: string): boolean {
  return url === 'about:blank'
  || url === 'about:srcdoc'
  || url?.startsWith('data:text/html') === true
}
