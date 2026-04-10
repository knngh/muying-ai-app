import React from 'react'
import { StyleSheet, View } from 'react-native'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { Button, Card, Text } from 'react-native-paper'
import LinearGradient from 'react-native-linear-gradient'
import { StandardCard } from '../layout'
import { colors, fontSize, spacing, borderRadius } from '../../theme'

interface GrowthArchiveCardProps {
  status: string
  onPress: () => void
}

export default function GrowthArchiveCard({ status, onPress }: GrowthArchiveCardProps) {
  return (
    <StandardCard style={styles.archiveCard}>
      <LinearGradient
        colors={['#F8E3D6', '#F1D1BF', '#FAF4EE']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.archiveGradient}
      >
        <View style={styles.archiveGlow} />
        <View style={styles.archiveRing} />
        <Card.Content>
          <View style={styles.archiveTopRow}>
            <View>
              <Text style={styles.archiveEyebrow}>长期档案</Text>
              <Text style={styles.archiveTitle}>
                把备孕、孕期、育儿和长期家庭记录整理成一份可回看的成长档案。
              </Text>
            </View>
            <View style={styles.archiveIconShell}>
              <MaterialCommunityIcons name="chart-timeline-variant" size={20} color={colors.techDark} />
            </View>
          </View>

          <View style={styles.featureRow}>
            {[
              { icon: 'timeline-clock-outline', label: '生命周期时间轴' },
              { icon: 'radar', label: '阶段里程碑' },
              { icon: 'share-variant-outline', label: '导出摘要' },
            ].map((item) => (
              <View key={item.label} style={styles.featureBadge}>
                <MaterialCommunityIcons name={item.icon} size={14} color={colors.techDark} />
                <Text style={styles.featureBadgeText}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.archiveNote}>
            <Text style={styles.archiveSubtitle}>
              {status === 'active'
                ? '现在可以查看生命周期时间轴，并导出一份可分享的档案摘要。'
                : '升级后可查看完整生命周期档案、时间轴和分享摘要。'}
            </Text>
          </View>

          <Button
            mode="contained"
            buttonColor={colors.ink}
            onPress={onPress}
            style={styles.archiveButton}
          >
            {status === 'active' ? '查看成长档案' : '查看档案预览'}
          </Button>
        </Card.Content>
      </LinearGradient>
    </StandardCard>
  )
}

const styles = StyleSheet.create({
  archiveCard: {
    backgroundColor: 'transparent',
  },
  archiveGradient: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  archiveGlow: {
    position: 'absolute',
    top: -26,
    right: -18,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,248,242,0.46)',
  },
  archiveRing: {
    position: 'absolute',
    top: 22,
    right: 20,
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.12)',
  },
  archiveTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  archiveIconShell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(220,236,238,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  archiveEyebrow: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginBottom: spacing.xs,
  },
  archiveTitle: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: colors.text,
    lineHeight: 22,
  },
  featureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  featureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(94, 126, 134, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
  },
  featureBadgeText: {
    color: colors.techDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  archiveNote: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,253,249,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.1)',
  },
  archiveSubtitle: {
    color: colors.textSecondary,
    lineHeight: 20,
    fontSize: fontSize.sm,
  },
  archiveButton: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    borderRadius: 999,
  },
})
