import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Avatar, Button, Chip, Text } from 'react-native-paper'
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
  return (
    <View style={styles.headerCentered}>
      <Avatar.Icon size={80} icon="account" style={styles.avatar} />
      <Text style={styles.headerNickname}>{nickname}</Text>
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
        >
          {status === 'active' ? '管理会员' : '立即升级'}
        </Button>
        <Button mode="outlined" textColor={colors.ink} onPress={onEditProfile}>
          编辑资料
        </Button>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  headerCentered: {
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: colors.primaryLight,
    marginBottom: spacing.md,
  },
  headerNickname: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  headerTags: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerChip: {
    backgroundColor: colors.goldLight,
  },
  headerChipText: {
    color: colors.gold,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  heroActions: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
  },
})
