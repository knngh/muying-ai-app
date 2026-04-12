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

function wrapArticleTables(html: string): string {
  return html.replace(/<table\b[\s\S]*?<\/table>/gi, (tableHtml) => {
    if (/article-table-wrap/.test(tableHtml)) {
      return tableHtml
    }
    return `<div class="article-table-wrap">${tableHtml}</div>`
  })
}

export function buildSafeArticleHtml(content: string): string {
  const safeContent = wrapArticleTables(sanitizeHtml(content))
  return `<html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"><style>html,body{padding:0;margin:0;background:#FFF9F4;overflow-x:hidden}body{font-size:16px;line-height:1.9;color:#35261E;word-break:break-word;overflow-wrap:anywhere}*{box-sizing:border-box}img,svg,video{display:block;max-width:100%!important;height:auto!important;border-radius:16px;margin:12px 0}a{color:#9F4E2E;text-decoration:none;word-break:break-all}p,li{color:#70554A}p{margin:0 0 1.1em}ul,ol{padding-left:1.2em;margin:0 0 1.1em}h1,h2,h3,h4{color:#241813;line-height:1.45;margin:0 0 0.8em}blockquote{margin:16px 0;padding:12px 16px;border-left:4px solid #D98A5D;background:#F8EBDD;border-radius:12px;color:#70554A}pre,code{white-space:pre-wrap;word-break:break-word}pre{background:#FFF4EA;border-radius:14px;padding:12px;overflow-x:auto}table{width:max-content;min-width:100%;max-width:none!important;border-collapse:collapse;background:#fff7f1;font-size:13px;line-height:1.6}th,td{min-width:96px;border:1px solid rgba(184,138,72,0.18);padding:10px 12px;vertical-align:top;text-align:left;white-space:normal}th{background:#F8EBDD;color:#35261E;font-weight:700}.article-table-wrap{width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;margin:16px 0;padding-bottom:4px;border:1px solid rgba(184,138,72,0.12);border-radius:16px;background:#fffdf9}.article-table-wrap table{max-width:none!important}hr{border:none;border-top:1px solid rgba(184,138,72,0.16);margin:18px 0}</style></head><body>${safeContent}</body></html>`
}

export function shouldAllowWebViewNavigation(url?: string): boolean {
  return url === 'about:blank'
  || url === 'about:srcdoc'
  || url?.startsWith('data:text/html') === true
}
