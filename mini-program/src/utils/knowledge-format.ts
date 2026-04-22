export function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatSourceLabel(label?: string): string {
  const value = (label || '').trim()
  if (!value) return '权威来源'

  const lower = value.toLowerCase()
  if (/american academy of pediatrics|healthychildren\.org|\baap\b/.test(lower)) return '美国儿科学会'
  if (/mayo clinic|mayoclinic\.org/.test(lower)) return '梅奥诊所'
  if (/msd manuals?|msdmanuals\.cn|merck manual/.test(lower)) return 'MSD 诊疗手册'
  if (/national health service|\bnhs\b|nhs\.uk/.test(lower)) return '英国国民保健署'
  if (/world health organization|\bwho\b|who\.int/.test(lower)) return '世界卫生组织'
  if (/centers? for disease control|\bcdc\b|cdc\.gov/.test(lower)) return '美国疾控中心'
  if (/american college of obstetricians and gynecologists|\bacog\b|acog\.org/.test(lower)) return '美国妇产科医师学会'
  if (/国家卫生健康委员会|国家卫健委/.test(value)) return '国家卫健委'
  if (/中国疾病预防控制中心|中国疾控/.test(value)) return '中国疾控'
  if (/国家疾病预防控制局/.test(value)) return '国家疾控局'
  return value
}

export function hasLeakedPrompt(text?: string): boolean {
  if (!text) return false
  return /<translated_(title|summary|content)>/i.test(text)
    || /Be accurate and faithful to the original/i.test(text)
}

function stripCodeFence(text: string): string {
  const matched = text.trim().match(/^```(?:xml|json|markdown|md|text)?\s*([\s\S]*?)\s*```$/i)
  return matched?.[1]?.trim() || text.trim()
}

export function stripHtmlTags(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|li|h[1-6]|section|article|div)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
}

export function sanitizeTranslationText(
  input: string | null | undefined,
  type: 'title' | 'summary' | 'content',
): string {
  if (!input) return ''

  let normalized = stripCodeFence(input)
    .replace(/<\/?translated_(title|summary|content)>/gi, '')
    .replace(/^\s*#{1,6}\s*/g, '')
    .replace(/^[`"'“”‘’]+|[`"'“”‘’]+$/g, '')
    .trim()

  if (hasLeakedPrompt(normalized)) {
    return ''
  }

  const labelPattern = type === 'title'
    ? /^(?:[-*•·]\s*)?(?:translated_title|title|标题)\s*[:：]\s*/i
    : type === 'summary'
      ? /^(?:[-*•·]\s*)?(?:translated_summary|summary|摘要)\s*[:：]\s*/i
      : /^(?:[-*•·]\s*)?(?:translated_content|content|正文|内容)\s*[:：]\s*/i

  normalized = normalized
    .replace(/^(?:好的[，,]?\s*)/u, '')
    .replace(/^(?:以下(?:是|为)|下面(?:是|为)|这是)(?:本篇|这篇|当前)?(?:文章|原文|内容)?(?:的)?(?:中文)?(?:辅助)?(?:翻译|译文|中文版)?\s*[：:。.]?\s*/u, '')
    .replace(labelPattern, '')
    .trim()

  return normalized
}

export function isGenericForeignTitle(title?: string): boolean {
  const value = (title || '').trim()
  if (!value) return false
  if (/[\u4e00-\u9fff]/u.test(value)) return false

  const normalized = value.toLowerCase()
  return normalized.length <= 24 && (
    /^(resources?|resource center|article|overview|guide|guidelines|information|faq|factsheet)$/i.test(normalized)
    || /^(recursos?|art[íi]culo|informaci[óo]n|gu[íi]a)$/i.test(normalized)
  )
}

export function getLocalizedFallbackTitle(topic?: string, stage?: string): string {
  const topicLabelMap: Record<string, string> = {
    pregnancy: '孕期与产检',
    postpartum: '产后恢复',
    newborn: '新生儿护理',
    feeding: '喂养与辅食',
    vaccination: '疫苗与预防',
    'common-symptoms': '常见症状判断',
    development: '发育与日常照护',
    policy: '政策与官方通知',
    general: '综合资料',
  }

  const stageLabelMap: Record<string, string> = {
    preparation: '备孕期',
    'first-trimester': '孕早期',
    'second-trimester': '孕中期',
    'third-trimester': '孕晚期',
    postpartum: '产后恢复',
    newborn: '月子/新生儿',
    '0-6-months': '0-6月',
    '6-12-months': '6-12月',
    '1-3-years': '1-3岁',
    '3-years-plus': '3岁+',
  }

  const primary = topicLabelMap[topic || ''] || stageLabelMap[stage || ''] || '权威'
  return `${primary}参考`
}

export function isMostlyChineseText(input: string): boolean {
  const text = input.replace(/\s+/g, '')
  if (!text) return false

  const chineseCount = (text.match(/[\u3400-\u4dbf\u4e00-\u9fff]/g) || []).length
  const latinCount = (text.match(/[A-Za-z]/g) || []).length

  if (chineseCount >= 30 && chineseCount >= latinCount) {
    return true
  }

  return chineseCount / Math.max(text.length, 1) >= 0.2 && chineseCount >= latinCount * 0.6
}

function normalizeBlock(input: string): string {
  return input
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function appendInlineStyle(attrs: string | undefined, inlineStyle: string): string {
  const normalizedAttrs = attrs || ''
  const styleMatch = normalizedAttrs.match(/\sstyle=(['"])(.*?)\1/i)

  if (!styleMatch) {
    return `${normalizedAttrs} style="${inlineStyle}"`
  }

  const quote = styleMatch[1]
  const existing = styleMatch[2]?.trim() || ''
  const merged = existing.endsWith(';') ? `${existing}${inlineStyle}` : `${existing};${inlineStyle}`
  return normalizedAttrs.replace(/\sstyle=(['"])(.*?)\1/i, ` style=${quote}${merged}${quote}`)
}

function addBlockSpacingToHtml(html: string): string {
  const blockStyles: Array<{ tag: string; style: string }> = [
    { tag: 'p', style: 'margin:0 0 1.1em;line-height:1.9;display:block;' },
    { tag: 'div', style: 'margin:0 0 1.1em;line-height:1.9;display:block;' },
    { tag: 'section', style: 'margin:0 0 1.1em;line-height:1.9;display:block;' },
    { tag: 'article', style: 'margin:0 0 1.1em;line-height:1.9;display:block;' },
    { tag: 'li', style: 'margin:0 0 0.7em;line-height:1.9;' },
    { tag: 'ul', style: 'margin:0 0 1em 1.2em;padding:0;' },
    { tag: 'ol', style: 'margin:0 0 1em 1.2em;padding:0;' },
    { tag: 'h1', style: 'margin:0 0 0.9em;line-height:1.5;font-weight:700;' },
    { tag: 'h2', style: 'margin:0 0 0.9em;line-height:1.55;font-weight:700;' },
    { tag: 'h3', style: 'margin:0 0 0.8em;line-height:1.6;font-weight:700;' },
    { tag: 'blockquote', style: 'margin:0 0 1em;padding-left:0.9em;border-left:4px solid #f4c7d7;color:#6b7785;' },
  ]

  return blockStyles.reduce((result, item) => (
    result.replace(new RegExp(`<${item.tag}(\\s[^>]*)?>`, 'gi'), (_match, attrs?: string) => (
      `<${item.tag}${appendInlineStyle(attrs, item.style)}>`
    ))
  ), html)
}

function isLikelyHeading(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false

  if (trimmed.length <= 24 && !/[。！？!?；;]$/.test(trimmed)) {
    return /^(第[一二三四五六七八九十百千万0-9]+[章节部分篇条]|[一二三四五六七八九十]+[、.．]|[0-9]+[、.．]|（[一二三四五六七八九十0-9]+）|附件|附：|提示|建议|结论|原因|措施|何时就医|不确定性说明|参考来源)/u.test(trimmed)
  }

  return false
}

function splitHeadingPrefix(line: string): { heading?: string; remainder?: string } {
  const trimmed = line.trim()
  const match = trimmed.match(/^(第[一二三四五六七八九十百千万0-9]+[章节部分篇条]|[一二三四五六七八九十]+[、.．]|[0-9]+[、.．]|（[一二三四五六七八九十0-9]+）|附件|附：|提示|建议|结论|原因|措施|何时就医|不确定性说明|参考来源)(.*)$/u)
  if (!match) return {}

  const heading = match[1]?.trim()
  const remainder = match[2]?.trim()
  if (!heading) return {}
  if (!remainder) return { heading }

  const headingTextMatch = remainder.match(/^([\u4e00-\u9fa5A-Za-z0-9]{2,12}?)(?=(如果|请|应|需|可|先|要|做|保持|观察|出现|及时|立即|继续|尽快|按照|根据|对于|将|建议|注意))/u)
  if (headingTextMatch?.[1]) {
    const headingText = headingTextMatch[1].trim()
    return {
      heading: `${heading}${headingText}`,
      remainder: remainder.slice(headingText.length).trim(),
    }
  }

  if (remainder.length <= 12 && !/[。！？!?；;]$/.test(remainder)) {
    return { heading: `${heading}${remainder}` }
  }

  return {
    heading: `${heading}${remainder.replace(/[。！？!?；;].*$/u, '').trim()}`.trim(),
    remainder,
  }
}

function splitIntoSentences(text: string): string[] {
  const normalized = text.trim()
  if (!normalized) return []

  const matched = normalized.match(/[^。！？!?；;]+[。！？!?；;]?/gu)
  if (!matched) return [normalized]
  return matched.map(item => item.trim()).filter(Boolean)
}

function chunkSentences(sentences: string[], maxChars = 88, maxSentences = 2): string[] {
  const chunks: string[] = []
  let current = ''
  let currentCount = 0

  for (const sentence of sentences) {
    const candidate = `${current}${sentence}`.trim()
    if (current && (candidate.length > maxChars || currentCount >= maxSentences)) {
      chunks.push(current.trim())
      current = sentence
      currentCount = 1
      continue
    }

    current = candidate
    currentCount += 1
  }

  if (current.trim()) {
    chunks.push(current.trim())
  }

  return chunks
}

function expandDenseParagraph(paragraph: string): string[] {
  const trimmed = paragraph.trim()
  if (!trimmed) return []

  if (trimmed.length <= 80 && splitIntoSentences(trimmed).length <= 2) {
    return [trimmed]
  }

  const sentences = splitIntoSentences(trimmed)
  if (sentences.length <= 2) {
    return [trimmed]
  }

  return chunkSentences(sentences)
}

export function segmentArticleText(text: string): string[] {
  const normalized = normalizeBlock(
    text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/([。！？!?；;])(?=(第[一二三四五六七八九十百千万0-9]+[章节部分篇条]|[一二三四五六七八九十]+[、.．]|[0-9]+[、.．]|（[一二三四五六七八九十0-9]+）|附件|附：|提示|建议|结论|原因|措施|何时就医|不确定性说明|参考来源))/gu, '$1\n')
      .replace(/([^\n])(第[一二三四五六七八九十百千万0-9]+[章节部分篇条])/gu, '$1\n$2')
      .replace(/([^\n])([一二三四五六七八九十]+[、.．])/gu, '$1\n$2')
      .replace(/([^\n])(（[一二三四五六七八九十0-9]+）)/gu, '$1\n$2'),
  )

  if (!normalized) return []

  const rawBlocks = normalized
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean)

  const result: string[] = []

  for (const rawBlock of rawBlocks) {
    const lines = rawBlock
      .split(/\n+/)
      .map(line => line.trim())
      .filter(Boolean)

    let buffer = ''
    for (const line of lines) {
      const splitHeading = splitHeadingPrefix(line)
      if (splitHeading.heading) {
        if (buffer.trim()) {
          result.push(...expandDenseParagraph(buffer))
          buffer = ''
        }

        result.push(splitHeading.heading)
        if (splitHeading.remainder) {
          buffer = splitHeading.remainder
        }
        continue
      }

      if (/^[-*•·]\s+/.test(line) || isLikelyHeading(line)) {
        if (buffer.trim()) {
          result.push(...expandDenseParagraph(buffer))
          buffer = ''
        }
        result.push(line)
        continue
      }

      buffer = buffer ? `${buffer} ${line}` : line
    }

    if (buffer.trim()) {
      result.push(...expandDenseParagraph(buffer))
    }
  }

  return result.filter(Boolean)
}

function textToRichParagraphHtml(text: string): string {
  return segmentArticleText(text)
    .map((paragraph) => {
      if (/^[-*•·]\s+/.test(paragraph)) {
        return `<p style="margin:0 0 1.1em;line-height:1.9;display:block;">${escapeHtml(paragraph.replace(/^[-*•·]\s+/, ''))}</p>`
      }

      return `<p style="margin:0 0 1.1em;line-height:1.9;display:block;">${escapeHtml(paragraph)}</p>`
    })
    .join('')
}

export function formatRichArticleContent(content: string): string {
  const trimmed = content.trim()
  if (!trimmed) return ''

  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    const sanitizedHtml = trimmed
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<(?:nav|footer|header|aside)[\s\S]*?<\/(?:nav|footer|header|aside)>/gi, '')
      .replace(/<(?:p|div|section|article)[^>]*>(?:\s|&nbsp;|&#160;|<br\s*\/?>)*<\/(?:p|div|section|article)>/gi, '')
      .trim()

    if (/<(?:p|div|section|article|li|ul|ol|h[1-6]|blockquote)\b/i.test(sanitizedHtml)) {
      return addBlockSpacingToHtml(sanitizedHtml)
    }

    return textToRichParagraphHtml(stripHtmlTags(sanitizedHtml))
  }

  return textToRichParagraphHtml(trimmed)
}
