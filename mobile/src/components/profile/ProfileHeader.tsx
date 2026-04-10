import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Avatar, Button, Chip, Text } from 'react-native-paper'
import LinearGradient from 'react-native-linear-gradient'
import { colors, fontSize, spacing, borderRadius } from '../../theme'

interface ProfileHeaderProps {
  nickname: string
  stageTitle: string
  memberLabel: string
  status: string
  onManageMembership: () => void
  onEditProfile: () => void
}

export default function ProfileHeader({
  nickname,
  stageTitle,
  memberLabel,
  status,
  onManageMembership,
  onEditProfile,
}: ProfileHeaderProps) {
  const statusLabel = status === 'active' ? '会员在线' : '基础模式'

  return (
    <LinearGradient
      colors={['#FAE5D7', '#F5D8C7', '#FBF3EB']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.headerCard}
    >
      <View style={styles.techOrbit} />
      <View style={styles.techRing} />
      <View style={styles.statusStrip}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>家庭档案主控台</Text>
        <Chip compact style={styles.statusChip} textStyle={styles.statusChipText}>
          {statusLabel}
        </Chip>
      </View>
      <View style={styles.headerCentered}>
        <View style={styles.avatarShell}>
          <Avatar.Icon size={82} icon="account" style={styles.avatar} />
        </View>
        <Text style={styles.headerEyebrow}>家庭主档案</Text>
        <Text style={styles.headerNickname}>{nickname}</Text>
        <Text style={styles.headerSubtitle}>
          围绕 {stageTitle} 持续管理资料、提醒、周报与成长记录。
        </Text>
        <View style={styles.headerTags}>
          <Chip style={styles.headerChip} textStyle={styles.headerChipText}>
            {stageTitle}
          </Chip>
          <Chip style={styles.headerChip} textStyle={styles.headerChipText}>
            {memberLabel}
          </Chip>
        </View>
        <View style={styles.heroActions}>
          <Button
            mode="contained"
            buttonColor={colors.ink}
            textColor={colors.white}
            onPress={onManageMembership}
            style={styles.primaryButton}
          >
            {status === 'active' ? '管理会员' : '立即升级'}
          </Button>
          <Button
            mode="contained-tonal"
            buttonColor="rgba(255, 253, 249, 0.84)"
            textColor={colors.ink}
            onPress={onEditProfile}
            style={styles.secondaryButton}
          >
            编辑资料
          </Button>
        </View>
      </View>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  headerCard: {
    width: '100%',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(185, 104, 66, 0.18)',
    overflow: 'hidden',
  },
  statusStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.tech,
  },
  statusText: {
    flex: 1,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.9,
    color: colors.techDark,
  },
  statusChip: {
    backgroundColor: 'rgba(255, 250, 246, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(94, 126, 134, 0.14)',
  },
  statusChipText: {
    color: colors.techDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  headerCentered: {
    alignItems: 'center',
  },
  avatarShell: {
    width: 98,
    height: 98,
    borderRadius: 49,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,253,249,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(94, 126, 134, 0.12)',
    marginBottom: spacing.md,
  },
  avatar: {
    backgroundColor: 'rgba(255, 253, 249, 0.96)',
  },
  headerEyebrow: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.primaryDark,
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  headerNickname: {
    fontSize: 30,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  headerSubtitle: {
    color: colors.inkSoft,
    fontSize: fontSize.md,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: spacing.md,
  },
  headerTags: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  headerChip: {
    backgroundColor: 'rgba(255, 253, 249, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(185, 104, 66, 0.12)',
  },
  headerChipText: {
    color: colors.primaryDark,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  heroActions: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  primaryButton: {
    borderRadius: borderRadius.pill,
    flex: 1,
  },
  secondaryButton: {
    borderRadius: borderRadius.pill,
    flex: 1,
  },
  techOrbit: {
    position: 'absolute',
    top: -26,
    right: -20,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(94, 126, 134, 0.08)',
  },
  techRing: {
    position: 'absolute',
    top: 34,
    right: 22,
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 1,
    borderColor: 'rgba(94, 126, 134, 0.12)',
  },
})
