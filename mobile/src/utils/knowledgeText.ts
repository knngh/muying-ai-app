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

export { hasTranslationPromptLeak as hasLeakedPrompt, sanitizeTranslationText } from '../../../shared/utils/article-translation'

export {
  addArticleHeadingAnchors,
  extractArticleOutline,
  formatRichArticleContent,
} from '../../../shared/utils/article-format'

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
