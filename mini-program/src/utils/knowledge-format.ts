export function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export {
  buildKnowledgeSourceDigest,
  buildKnowledgeVariantReadingSuggestion,
  buildKnowledgeVariantSortFeedback,
  buildKnowledgeVariantPreview,
  buildKnowledgeReadingMeta,
  formatKnowledgeDisplayDate,
  buildKnowledgeReadingPath,
  getKnowledgeDisplaySummary,
  getKnowledgeDisplayTags,
  getKnowledgeDisplayTitle,
  getKnowledgeFallbackSummary,
  getKnowledgeSourceLabel,
  getKnowledgeSourceSignal,
  getKnowledgeStageLabel,
  isChineseKnowledgeArticle,
  normalizeKnowledgeLabel,
  sanitizeAuthoritySourceUrl,
  shouldHideAuthorityCategoryChip,
  toReadableUrl,
} from '../../../shared/utils/knowledge-presentation'

export {
  formatKnowledgeStageLabel,
  formatSourceLabel,
  getLocalizedFallbackTitle,
  isGenericForeignTitle,
  isMostlyChineseText,
  normalizePlainText,
  stripHtmlTags,
} from '../../../shared/utils/knowledge-text'

export {
  addArticleHeadingAnchors,
  extractArticleOutline,
  formatRichArticleContent,
  segmentArticleText,
  textToRichParagraphHtml,
} from '../../../shared/utils/article-format'

export {
  hasTranslationPromptLeak as hasLeakedPrompt,
  sanitizeTranslationText,
} from '../../../shared/utils/article-translation'

export {
  containsDeathRelatedTerms,
  getSensitiveKnowledgeDropReason,
  isHighRiskOrClickbaitTitle,
  isSensitiveKnowledgeQuery,
} from '../../../shared/utils/knowledge-content-guard'

export {
  buildKnowledgeVariantFilterFeedback,
  buildKnowledgeVariantRecommendation,
  buildKnowledgeRepresentativeReason,
  buildKnowledgeVariantDifference,
  dedupeKnowledgeArticles,
  filterKnowledgeVariants,
  groupKnowledgeArticles,
  isChineseKnowledgeVariant,
  sortKnowledgeVariants,
} from '../../../shared/utils/knowledge-dedupe'
