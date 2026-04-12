import React from 'react'
import { StyleSheet, View } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { Button, Text } from 'react-native-paper'
import type { StageCircleSnapshot } from '../../../../shared/types'
import { Skeleton } from '../common'
import { StandardCard } from '../layout'
import { borderRadius, colors, spacing } from '../../theme'

interface StageCircleCardProps {
  circle: StageCircleSnapshot | null
  loading: boolean
  onPress: () => void
}

function getMemberInitial(name: string) {
  return name.trim().slice(0, 1) || '友'
}

export default function StageCircleCard({
  circle,
  loading,
  onPress,
}: StageCircleCardProps) {
  const title = circle?.title || '同周期互助圈'
  const subtitle = circle?.subtitle || '按孕周匹配 5-10 人小组，适合交流产检、作息、补剂和日常支持。'
  const progressText = circle
    ? `${circle.matchedMembers}/${circle.targetMembers} 人`
    : '5-10 人小组'
  const stageText = circle
    ? `${circle.stageLabel} · 孕 ${circle.currentWeek} 周`
    : '孕期开放'

  return (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>同周期互助</Text>
        <Text style={styles.sectionMeta}>小组支持</Text>
      </View>

      <StandardCard onPress={onPress} style={styles.card}>
        <LinearGradient
          colors={['rgba(34, 69, 80, 0.98)', 'rgba(71, 112, 122, 0.96)', 'rgba(234, 219, 207, 0.94)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardGradient}
        >
          <View style={styles.glow} />
          <View style={styles.ring} />
          <View style={styles.grid} />

          <View style={styles.topRow}>
            <View style={styles.eyebrowRow}>
              <View style={styles.signalDot} />
              <Text style={styles.eyebrow}>阶段匹配</Text>
            </View>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>{progressText}</Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <Skeleton width="48%" height={22} borderRadius={12} />
              <Skeleton width="82%" height={18} borderRadius={10} />
              <Skeleton width="66%" height={18} borderRadius={10} />
            </View>
          ) : (
            <>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </>
          )}

          <View style={styles.bottomRow}>
            <View style={styles.memberRow}>
              {(circle?.members?.slice(0, 4) || ['同', '周', '互', '助']).map((item, index) => {
                const key = typeof item === 'string' ? `${item}-${index}` : item.id
                const initial = typeof item === 'string' ? item : getMemberInitial(item.nickname)
                return (
                  <View key={key} style={[styles.memberBubble, index > 0 && styles.memberBubbleOffset]}>
                    <Text style={styles.memberBubbleText}>{initial}</Text>
                  </View>
                )
              })}
            </View>

            <View style={styles.statusWrap}>
              <Text style={styles.statusText}>{stageText}</Text>
              <Button
                compact
                mode="contained-tonal"
                buttonColor="rgba(255, 248, 240, 0.86)"
                textColor={colors.techDark}
                onPress={onPress}
                style={styles.ctaButton}
                labelStyle={styles.ctaButtonLabel}
              >
                进入查看
              </Button>
            </View>
          </View>
        </LinearGradient>
      </StandardCard>
    </View>
  )
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs + 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  sectionMeta: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  card: {
    marginBottom: 0,
    backgroundColor: 'transparent',
  },
  cardGradient: {
    padding: spacing.sm + 4,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -28,
    right: -8,
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  ring: {
    position: 'absolute',
    top: 18,
    right: 20,
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: 'rgba(223, 244, 248, 0.22)',
  },
  grid: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 1,
    borderColor: 'rgba(229, 245, 248, 0.14)',
    opacity: 0.42,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  signalDot: {
    width: 6,
    height: 6,
    borderRadius: borderRadius.pill,
    backgroundColor: '#FFD7A2',
  },
  eyebrow: {
    color: '#F4FBFC',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  metaPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(8, 26, 32, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(223, 244, 248, 0.18)',
  },
  metaPillText: {
    color: '#F5FCFD',
    fontSize: 10,
    fontWeight: '700',
  },
  loadingWrap: {
    gap: spacing.xs + 2,
    marginBottom: spacing.sm + 2,
  },
  title: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: 'rgba(244, 252, 253, 0.82)',
    fontSize: 12,
    lineHeight: 18,
  },
  bottomRow: {
    marginTop: spacing.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  memberBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 248, 240, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.42)',
  },
  memberBubbleOffset: {
    marginLeft: -8,
  },
  memberBubbleText: {
    color: colors.techDark,
    fontSize: 11,
    fontWeight: '700',
  },
  statusWrap: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 6,
  },
  statusText: {
    color: '#F3FBFC',
    fontSize: 11,
    fontWeight: '600',
  },
  ctaButton: {
    borderRadius: borderRadius.pill,
  },
  ctaButtonLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
})
