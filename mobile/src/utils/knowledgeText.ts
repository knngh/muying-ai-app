export function hasLeakedPrompt(text?: string) {
  if (!text) return false
  return /<translated_(title|summary|content)>/i.test(text)
    || /Be accurate and faithful to the original/i.test(text)
}

export function stripHtmlTags(input: string) {
  return input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|li|h[1-6]|section|article|div)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
}

export function normalizePlainText(input?: string | null) {
  return stripHtmlTags(input || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripCodeFence(text: string) {
  const matched = text.trim().match(/^```(?:xml|json|markdown|md|text)?\s*([\s\S]*?)\s*```$/i)
  return matched?.[1]?.trim() || text.trim()
}

export function sanitizeTranslationText(
  input: string | null | undefined,
  type: 'title' | 'summary' | 'content',
) {
  if (!input) return ''

  const labelPattern = type === 'title'
    ? /^(?:[-*•·]\s*)?(?:translated_title|title|标题)\s*[:：]\s*/i
    : type === 'summary'
      ? /^(?:[-*•·]\s*)?(?:translated_summary|summary|摘要)\s*[:：]\s*/i
      : /^(?:[-*•·]\s*)?(?:translated_content|content|正文|内容)\s*[:：]\s*/i

  let normalized = stripCodeFence(input)
    .replace(/<\/?translated_(title|summary|content)>/gi, '')
    .replace(/^\s*#{1,6}\s*/g, '')
    .replace(/^[`"'“”‘’]+|[`"'“”‘’]+$/g, '')
    .trim()

  if (hasLeakedPrompt(normalized)) {
    return ''
  }

  normalized = normalized
    .replace(/^(?:好的[，,]?\s*)/u, '')
    .replace(/^(?:以下(?:是|为)|下面(?:是|为)|这是)(?:本篇|这篇|当前)?(?:文章|原文|内容)?(?:的)?(?:中文)?(?:辅助)?(?:翻译|译文|中文版)?\s*[：:。.]?\s*/u, '')
    .replace(labelPattern, '')
    .trim()

  return normalized
}

export function isGenericForeignTitle(title?: string) {
  const value = (title || '').trim()
  if (!value) return false
  if (/[\u4e00-\u9fff]/u.test(value)) return false

  const normalized = value.toLowerCase()
  return normalized.length <= 24 && (
    /^(resources?|resource center|article|overview|guide|guidelines|information|faq|factsheet)$/i.test(normalized)
    || /^(recursos?|art[íi]culo|informaci[óo]n|gu[íi]a)$/i.test(normalized)
  )
}

export function isMostlyChineseText(input: string) {
  const text = input.replace(/\s+/g, '')
  if (!text) return false

  const chineseCount = (text.match(/[\u3400-\u4dbf\u4e00-\u9fff]/g) || []).length
  const latinCount = (text.match(/[A-Za-z]/g) || []).length

  if (chineseCount >= 24 && chineseCount >= latinCount) {
    return true
  }

  const letterCount = chineseCount + latinCount
  if (!letterCount) return false

  return chineseCount / letterCount >= 0.45
}
