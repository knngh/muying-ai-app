import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Skeleton } from '../common'
import { spacing, borderRadius } from '../../theme'

export default function ProfileSkeleton() {
  return (
    <View style={styles.container}>
      {/* Avatar */}
      <View style={styles.centered}>
        <Skeleton width={80} height={80} borderRadius={40} />
        <Skeleton width={120} height={20} style={styles.mt} />
        <View style={styles.tagRow}>
          <Skeleton width={70} height={24} borderRadius={borderRadius.pill} />
          <Skeleton width={70} height={24} borderRadius={borderRadius.pill} />
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} width="30%" height={70} borderRadius={borderRadius.lg} />
        ))}
      </View>

      {/* Account info */}
      <Skeleton width={100} height={18} style={styles.sectionTitle} />
      <Skeleton width="100%" height={280} borderRadius={borderRadius.lg} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    gap: spacing.lg,
  },
  centered: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  mt: {
    marginTop: spacing.sm,
  },
  tagRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },
})
