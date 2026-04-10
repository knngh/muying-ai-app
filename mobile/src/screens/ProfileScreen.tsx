import React from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import LinearGradient from 'react-native-linear-gradient'
import { Button, Snackbar, Text } from 'react-native-paper'
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
    formCaregiverRole,
    formChildNickname,
    formChildBirthMode,
    formFeedingMode,
    formDevelopmentConcerns,
    formFamilyNotes,
    snackMessage,
    setSnackMessage,
    setFormNickname,
    setFormPregnancyStatus,
    setFormDueDate,
    setFormBabyBirthday,
    setFormBabyGender,
    setFormCaregiverRole,
    setFormChildNickname,
    setFormChildBirthMode,
    setFormFeedingMode,
    setFormDevelopmentConcerns,
    setFormFamilyNotes,
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
          <View style={styles.familyEntryCard}>
            <LinearGradient
              colors={['rgba(248,227,214,0.96)', 'rgba(241,209,191,0.92)', 'rgba(250,244,238,0.98)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.familyEntryGradient}
            >
              <View style={styles.familyEntryGlow} />
              <View style={styles.familyEntryRing} />
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>家庭档案</Text>
                <Text style={styles.sectionMeta}>全生命周期视图</Text>
              </View>
              <Text style={styles.familyEntryText}>
                把照护者、孩子信息、发育关注点和生命周期时间轴整理成一页持续更新的家庭主档案。
              </Text>
              <Button
                mode="contained"
                buttonColor={colors.ink}
                style={styles.familyEntryButton}
                onPress={() => navigation.navigate('FamilyProfile')}
              >
                查看家庭档案
              </Button>
            </LinearGradient>
          </View>
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
            <Text style={styles.sectionTitle}>陪伴能力</Text>
            <Text style={styles.sectionMeta}>当前阶段可联动使用</Text>
          </View>
          <View style={styles.benefitWrap}>
            {[
              { icon: 'robot-outline', title: '问题助手', subtitle: '围绕阶段连续追问' },
              { icon: 'file-chart-outline', title: '周度报告', subtitle: '阶段建议持续更新' },
              { icon: 'account-group-outline', title: '阶段圈子', subtitle: '围绕生命周期交流' },
              { icon: 'export-variant', title: '成长档案', subtitle: '家庭摘要可长期回看' },
            ].map((item) => (
              <View key={item.title} style={styles.benefitTile}>
                <View style={styles.benefitTileWash} />
                <View style={styles.benefitIconShell}>
                  <MaterialCommunityIcons name={item.icon} size={18} color={colors.techDark} />
                </View>
                <Text style={styles.benefitTitle}>{item.title}</Text>
                <Text style={styles.benefitSubtitle}>{item.subtitle}</Text>
              </View>
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
        caregiverRole={formCaregiverRole}
        childNickname={formChildNickname}
        childBirthMode={formChildBirthMode}
        feedingMode={formFeedingMode}
        developmentConcerns={formDevelopmentConcerns}
        familyNotes={formFamilyNotes}
        onChangeNickname={setFormNickname}
        onChangePregnancyStatus={setFormPregnancyStatus}
        onChangeDueDate={setFormDueDate}
        onChangeBabyBirthday={setFormBabyBirthday}
        onChangeBabyGender={setFormBabyGender}
        onChangeCaregiverRole={setFormCaregiverRole}
        onChangeChildNickname={setFormChildNickname}
        onChangeChildBirthMode={setFormChildBirthMode}
        onChangeFeedingMode={setFormFeedingMode}
        onChangeDevelopmentConcerns={setFormDevelopmentConcerns}
        onChangeFamilyNotes={setFormFamilyNotes}
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
  benefitTile: {
    width: '48%',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    backgroundColor: 'rgba(255, 249, 244, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(94, 126, 134, 0.12)',
    minHeight: 116,
    overflow: 'hidden',
  },
  benefitTileWash: {
    position: 'absolute',
    top: -14,
    right: -8,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(220,236,238,0.16)',
  },
  benefitIconShell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(94, 126, 134, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  benefitTitle: {
    color: colors.inkDeep,
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: 4,
  },
  benefitSubtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
  familyEntryCard: {
    overflow: 'hidden',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(185,104,66,0.14)',
  },
  familyEntryGradient: {
    padding: spacing.md,
    overflow: 'hidden',
  },
  familyEntryGlow: {
    position: 'absolute',
    top: -26,
    right: -18,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,248,242,0.44)',
  },
  familyEntryRing: {
    position: 'absolute',
    top: 20,
    right: 24,
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.12)',
  },
  familyEntryText: {
    color: colors.inkSoft,
    lineHeight: 21,
    maxWidth: '82%',
  },
  familyEntryButton: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    borderRadius: borderRadius.pill,
  },
  logoutButton: {
    marginTop: spacing.md,
    borderColor: colors.red,
  },
})
