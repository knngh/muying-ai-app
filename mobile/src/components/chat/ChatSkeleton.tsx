import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Skeleton } from '../common'
import { spacing, borderRadius } from '../../theme'

export default function ChatSkeleton() {
  return (
    <View style={styles.container}>
      {/* Quota card */}
      <Skeleton width="100%" height={100} borderRadius={borderRadius.xl} />

      {/* Message skeletons */}
      <View style={styles.messages}>
        <View style={styles.assistantRow}>
          <Skeleton width="70%" height={60} borderRadius={borderRadius.xl} />
        </View>
        <View style={styles.userRow}>
          <Skeleton width="50%" height={40} borderRadius={borderRadius.xl} />
        </View>
        <View style={styles.assistantRow}>
          <Skeleton width="80%" height={80} borderRadius={borderRadius.xl} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    gap: spacing.lg,
  },
  messages: {
    gap: spacing.md,
  },
  assistantRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
})
