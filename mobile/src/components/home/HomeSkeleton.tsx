import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Skeleton } from '../common'
import { spacing, borderRadius } from '../../theme'

export default function HomeSkeleton() {
  return (
    <View style={styles.container}>
      {/* Hero card */}
      <Skeleton width="100%" height={180} borderRadius={borderRadius.xl} />

      {/* Quick actions */}
      <View style={styles.quickRow}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.quickItem}>
            <Skeleton width={56} height={56} borderRadius={28} />
            <Skeleton width={40} height={12} style={styles.mt} />
          </View>
        ))}
      </View>

      {/* Info grid */}
      <View style={styles.gridRow}>
        <Skeleton width="48%" height={90} borderRadius={borderRadius.lg} />
        <Skeleton width="48%" height={90} borderRadius={borderRadius.lg} />
      </View>

      {/* Articles */}
      <Skeleton width={120} height={18} style={styles.sectionTitle} />
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} width="100%" height={72} borderRadius={borderRadius.lg} style={styles.card} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    gap: spacing.lg,
  },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickItem: {
    alignItems: 'center',
  },
  mt: {
    marginTop: spacing.xs,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },
  card: {
    marginBottom: spacing.sm,
  },
})
