import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Text } from 'react-native-paper'
import type { AIMessage } from '../../api/ai'
import { colors, fontSize, spacing, borderRadius } from '../../theme'

interface SourcesListProps {
  messageId: string
  sources: NonNullable<AIMessage['sources']>
}

export default function SourcesList({ messageId, sources }: SourcesListProps) {
  if (sources.length === 0) return null

  return (
    <View style={styles.sourcesWrap}>
      <Text style={styles.sourcesTitle}>参考来源</Text>
      {sources.map((source) => (
        <View key={`${messageId}-${source.title}`} style={styles.sourceCard}>
          <Text style={styles.sourceName}>{source.title}</Text>
          <Text style={styles.sourceMeta}>
            {source.source} {'\u00B7'} 相关度 {Math.round(source.relevance * 100)}%
          </Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  sourcesWrap: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  sourcesTitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  sourceCard: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
  },
  sourceName: {
    fontWeight: '700',
    color: colors.text,
  },
  sourceMeta: {
    marginTop: spacing.xs,
    color: colors.textLight,
    fontSize: fontSize.sm,
  },
})
