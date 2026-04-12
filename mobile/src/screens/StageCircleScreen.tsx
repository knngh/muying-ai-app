import React, { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import LinearGradient from 'react-native-linear-gradient'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { Button, Text } from 'react-native-paper'
import type { StageCircleSnapshot } from '../../../shared/types'
import { communityApi } from '../api/community'
import { Skeleton } from '../components/common'
import { ContentSection, ScreenContainer, StandardCard } from '../components/layout'
import { borderRadius, colors, spacing } from '../theme'

function getInitial(name: string) {
  return name.trim().slice(0, 1) || '友'
}

export default function StageCircleScreen() {
  const [circle, setCircle] = useState<StageCircleSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadCircle = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const snapshot = await communityApi.getCurrentStageCircle()
      setCircle(snapshot)
    } catch (err) {
      const status = typeof err === 'object' && err && 'status' in err ? (err as { status?: number }).status : undefined
      const rawMessage = err instanceof Error ? err.message : '当前暂时无法加载互助圈'
      const message = status === 404 || rawMessage.includes('资源不存在')
        ? '当前服务器还没有部署互助圈接口，请先同步后端后再进入查看。'
        : status === 403 || rawMessage.includes('仅会员可用')
          ? '同周期互助当前为会员能力，请先开通会员后再进入。'
          : rawMessage
      setCircle(null)
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void loadCircle()
    }, [loadCircle]),
  )

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <ContentSection style={styles.compactSection}>
          <StandardCard style={styles.heroCard} elevation={2}>
            <LinearGradient
              colors={['rgba(33, 67, 79, 0.98)', 'rgba(71, 111, 122, 0.96)', 'rgba(234, 219, 207, 0.94)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroGradient}
            >
              <View style={styles.heroGlow} />
              <View style={styles.heroRing} />
              <View style={styles.heroGrid} />

              <View style={styles.heroTopRow}>
                <View style={styles.heroEyebrowRow}>
                  <View style={styles.heroSignal} />
                  <Text style={styles.heroEyebrow}>同周期互助小组</Text>
                </View>
                {circle ? (
                  <View style={styles.heroMetaPill}>
                    <Text style={styles.heroMetaPillText}>
                      {circle.matchedMembers}/{circle.targetMembers} 人
                    </Text>
                  </View>
                ) : null}
              </View>

              {loading ? (
                <View style={styles.heroLoading}>
                  <Skeleton width="44%" height={24} borderRadius={12} />
                  <Skeleton width="76%" height={18} borderRadius={10} />
                  <Skeleton width="66%" height={18} borderRadius={10} />
                </View>
              ) : (
                <>
                  <Text style={styles.heroTitle}>{circle?.title || '同周期互助圈'}</Text>
                  <Text style={styles.heroSubtitle}>
                    {circle?.subtitle || '当前还没有可展示的匹配结果。'}
                  </Text>
                </>
              )}

              <View style={styles.heroStatsRow}>
                <View style={styles.heroStatItem}>
                  <Text style={styles.heroStatValue}>{circle?.stageLabel || '--'}</Text>
                  <Text style={styles.heroStatLabel}>当前阶段</Text>
                </View>
                <View style={styles.heroDivider} />
                <View style={styles.heroStatItem}>
                  <Text style={styles.heroStatValue}>{circle?.currentWeek ? `孕 ${circle.currentWeek} 周` : '--'}</Text>
                  <Text style={styles.heroStatLabel}>当前孕周</Text>
                </View>
                <View style={styles.heroDivider} />
                <View style={styles.heroStatItem}>
                  <Text style={styles.heroStatValue}>{circle?.isReady ? '已成组' : '匹配中'}</Text>
                  <Text style={styles.heroStatLabel}>小组状态</Text>
                </View>
              </View>
            </LinearGradient>
          </StandardCard>
        </ContentSection>

        {error ? (
          <ContentSection style={styles.compactSection}>
            <StandardCard style={styles.errorCard}>
              <View style={styles.errorRow}>
                <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.primaryDark} />
                <Text style={styles.errorTitle}>当前无法进入同周期互助</Text>
              </View>
              <Text style={styles.errorText}>{error}</Text>
              <Button mode="contained-tonal" onPress={() => void loadCircle()} style={styles.retryButton}>
                重新加载
              </Button>
            </StandardCard>
          </ContentSection>
        ) : null}

        {circle ? (
          <>
            <ContentSection style={styles.compactSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>匹配成员</Text>
                <Text style={styles.sectionMeta}>
                  {circle.weekRange.start}-{circle.weekRange.end} 周
                </Text>
              </View>
              <View style={styles.memberGrid}>
                {circle.members.map((member) => (
                  <StandardCard key={member.id} style={styles.memberCard}>
                    <View style={styles.memberCardContent}>
                      <View style={[styles.memberAvatar, member.isCurrentUser && styles.memberAvatarCurrent]}>
                        <Text style={styles.memberAvatarText}>{getInitial(member.nickname)}</Text>
                      </View>
                      <Text style={styles.memberName} numberOfLines={1}>
                        {member.nickname}
                      </Text>
                      <Text style={styles.memberWeek}>{member.weekLabel}</Text>
                      <View style={[styles.memberRolePill, member.role === 'host' && styles.memberRolePillHost]}>
                        <Text style={[styles.memberRoleText, member.role === 'host' && styles.memberRoleTextHost]}>
                          {member.role === 'host' ? '圈主' : member.isCurrentUser ? '你' : '成员'}
                        </Text>
                      </View>
                    </View>
                  </StandardCard>
                ))}
              </View>
            </ContentSection>

            <ContentSection style={styles.compactSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>建议开场</Text>
                <Text style={styles.sectionMeta}>便于破冰</Text>
              </View>
              {circle.discussionPrompts.map((prompt) => (
                <StandardCard key={prompt} style={styles.promptCard}>
                  <View style={styles.promptRow}>
                    <MaterialCommunityIcons name="chat-processing-outline" size={16} color={colors.techDark} />
                    <Text style={styles.promptText}>{prompt}</Text>
                  </View>
                </StandardCard>
              ))}
            </ContentSection>

            <ContentSection style={styles.compactSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>互助规则</Text>
                <Text style={styles.sectionMeta}>先看再聊</Text>
              </View>
              <StandardCard style={styles.ruleCard}>
                <View style={styles.ruleList}>
                  {circle.rules.map((rule) => (
                    <View key={rule} style={styles.ruleItem}>
                      <View style={styles.ruleDot} />
                      <Text style={styles.ruleText}>{rule}</Text>
                    </View>
                  ))}
                </View>
              </StandardCard>
            </ContentSection>
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.xxxl * 3,
  },
  compactSection: {
    marginBottom: spacing.md + 2,
  },
  heroCard: {
    backgroundColor: 'transparent',
    marginBottom: 0,
  },
  heroGradient: {
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -36,
    right: -12,
    width: 156,
    height: 156,
    borderRadius: 78,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroRing: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 1,
    borderColor: 'rgba(223, 244, 248, 0.2)',
  },
  heroGrid: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 1,
    borderColor: 'rgba(229, 245, 248, 0.14)',
    opacity: 0.42,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  heroEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  heroSignal: {
    width: 6,
    height: 6,
    borderRadius: borderRadius.pill,
    backgroundColor: '#FFD7A2',
  },
  heroEyebrow: {
    color: '#F3FBFC',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  heroMetaPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(8, 26, 32, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(223, 244, 248, 0.18)',
  },
  heroMetaPillText: {
    color: '#F5FCFD',
    fontSize: 10,
    fontWeight: '700',
  },
  heroLoading: {
    gap: spacing.xs + 2,
    marginBottom: spacing.md,
  },
  heroTitle: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  heroSubtitle: {
    color: 'rgba(244, 252, 253, 0.82)',
    fontSize: 12,
    lineHeight: 18,
  },
  heroStatsRow: {
    marginTop: spacing.md,
    paddingTop: spacing.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(230, 245, 247, 0.14)',
  },
  heroStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatValue: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  heroStatLabel: {
    color: 'rgba(244, 252, 253, 0.72)',
    fontSize: 10,
    marginTop: 3,
  },
  heroDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(230, 245, 247, 0.16)',
  },
  errorCard: {
    padding: spacing.md,
    marginBottom: 0,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  errorTitle: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  retryButton: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
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
  memberGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  memberCard: {
    width: '48%',
    marginBottom: 0,
  },
  memberCardContent: {
    padding: spacing.sm + 4,
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  memberAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(220,236,238,0.72)',
  },
  memberAvatarCurrent: {
    backgroundColor: 'rgba(248,227,214,0.9)',
  },
  memberAvatarText: {
    color: colors.techDark,
    fontSize: 14,
    fontWeight: '700',
  },
  memberName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  memberWeek: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  memberRolePill: {
    marginTop: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(220,236,238,0.58)',
  },
  memberRolePillHost: {
    backgroundColor: 'rgba(248,227,214,0.86)',
  },
  memberRoleText: {
    color: colors.techDark,
    fontSize: 10,
    fontWeight: '700',
  },
  memberRoleTextHost: {
    color: colors.primaryDark,
  },
  promptCard: {
    marginBottom: spacing.sm,
  },
  promptRow: {
    padding: spacing.sm + 4,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  promptText: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    lineHeight: 18,
  },
  ruleCard: {
    marginBottom: 0,
  },
  ruleList: {
    padding: spacing.sm + 4,
    gap: spacing.sm,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs + 2,
  },
  ruleDot: {
    width: 6,
    height: 6,
    marginTop: 6,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.primaryDark,
  },
  ruleText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
})
