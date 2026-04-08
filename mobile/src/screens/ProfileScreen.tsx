import React from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Button, Chip, Snackbar, Text } from 'react-native-paper'
import { useNavigation } from '@react-navigation/native'
import { ScreenContainer, ContentSection } from '../components/layout'
import {
  ProfileHeader,
  StatsRow,
  AccountInfo,
  WeeklyReportList,
  GrowthArchiveCard,
  EditProfileModal,
  ProfileSkeleton,
} from '../components/profile'
import { useProfileData } from '../hooks/useProfileData'
import { colors, fontSize, spacing, borderRadius } from '../theme'

export default function ProfileScreen() {
  const navigation = useNavigation<any>()
  const {
    user,
    initialLoading,
    stage,
    status,
    weeklyReports,
    checkInStreak,
    weeklyCompletionRate,
    accountRows,
    usageLabel,
    memberLabel,
    editModalVisible,
    formNickname,
    formPregnancyStatus,
    formDueDate,
    formBabyBirthday,
    formBabyGender,
    snackMessage,
    setSnackMessage,
    setFormNickname,
    setFormPregnancyStatus,
    setFormDueDate,
    setFormBabyBirthday,
    setFormBabyGender,
    openEditModal,
    setEditModalVisible,
    handleSaveProfile,
    handleLogout,
  } = useProfileData()

  if (initialLoading) {
    return (
      <ScreenContainer>
        <ProfileSkeleton />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <ContentSection style={styles.headerSection}>
          <ProfileHeader
            nickname={user?.nickname || user?.username || '未设置昵称'}
            stageTitle={stage.title}
            memberLabel={memberLabel}
            status={status}
            onManageMembership={() => navigation.navigate('Membership')}
            onEditProfile={openEditModal}
          />
        </ContentSection>

        <ContentSection>
          <StatsRow
            usageLabel={usageLabel}
            checkInStreak={checkInStreak}
            weeklyCompletionRate={weeklyCompletionRate}
          />
        </ContentSection>

        <ContentSection>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>账户资料</Text>
          </View>
          <AccountInfo rows={accountRows} onPress={openEditModal} />
        </ContentSection>

        <ContentSection>
          <WeeklyReportList
            reports={weeklyReports}
            status={status}
            onViewMore={() =>
              navigation.navigate(status === 'active' ? 'WeeklyReport' : 'Membership')
            }
          />
        </ContentSection>

        <ContentSection>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>会员权益速览</Text>
          </View>
          <View style={styles.benefitWrap}>
            {['问题助手不限次', '个性化周度报告', '阶段圈子', '成长档案导出'].map((item) => (
              <Chip key={item} style={styles.benefitChip} textStyle={styles.benefitChipText}>
                {item}
              </Chip>
            ))}
          </View>
        </ContentSection>

        <ContentSection>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>成长档案</Text>
            <Text style={styles.sectionMeta}>
              {status === 'active' ? '会员增强能力' : '预览版'}
            </Text>
          </View>
          <GrowthArchiveCard
            status={status}
            onPress={() => navigation.navigate('GrowthArchive')}
          />
        </ContentSection>

        <ContentSection>
          <Button
            mode="outlined"
            icon="logout"
            onPress={handleLogout}
            style={styles.logoutButton}
            textColor={colors.red}
          >
            退出登录
          </Button>
        </ContentSection>
      </ScrollView>

      <EditProfileModal
        visible={editModalVisible}
        nickname={formNickname}
        pregnancyStatus={formPregnancyStatus}
        dueDate={formDueDate}
        babyBirthday={formBabyBirthday}
        babyGender={formBabyGender}
        onChangeNickname={setFormNickname}
        onChangePregnancyStatus={setFormPregnancyStatus}
        onChangeDueDate={setFormDueDate}
        onChangeBabyBirthday={setFormBabyBirthday}
        onChangeBabyGender={setFormBabyGender}
        onSave={handleSaveProfile}
        onDismiss={() => setEditModalVisible(false)}
      />

      <Snackbar
        visible={!!snackMessage}
        onDismiss={() => setSnackMessage('')}
        duration={2000}
      >
        {snackMessage}
      </Snackbar>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xl,
  },
  headerSection: {
    marginTop: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
  },
  sectionMeta: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  benefitWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  benefitChip: {
    backgroundColor: colors.goldLight,
    borderRadius: borderRadius.pill,
  },
  benefitChipText: {
    color: colors.gold,
    fontWeight: '600',
  },
  logoutButton: {
    marginTop: spacing.md,
    borderColor: colors.red,
  },
})
