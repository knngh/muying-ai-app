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
          <View style={styles.sourceRail} />
          <View style={styles.sourceBody}>
            <Text style={styles.sourceName}>{source.title}</Text>
            <Text style={styles.sourceMeta}>
              {source.source} {'\u00B7'} 相关度 {Math.round(source.relevance * 100)}%
            </Text>
          </View>
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(246, 238, 230, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.12)',
  },
  sourceRail: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(94,126,134,0.26)',
  },
  sourceBody: {
    flex: 1,
  },
  sourceName: {
    fontWeight: '700',
    color: colors.text,
    lineHeight: 20,
  },
  sourceMeta: {
    marginTop: spacing.xs,
    color: colors.textLight,
    fontSize: fontSize.sm,
  },
})
