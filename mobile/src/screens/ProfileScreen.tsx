import React, { useEffect } from 'react'
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import LinearGradient from 'react-native-linear-gradient'
import { Button, Snackbar, Text } from 'react-native-paper'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { CompositeNavigationProp, RouteProp } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import type { StackNavigationProp } from '@react-navigation/stack'
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
import type { RootStackParamList, TabParamList } from '../navigation/AppNavigator'
import { colors, fontSize, spacing, borderRadius } from '../theme'

const TAB_SCROLL_BOTTOM_GAP = spacing.xxxl * 4 + spacing.lg

type ProfileNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Profile'>,
  StackNavigationProp<RootStackParamList>
>
type ProfileRouteProp = RouteProp<TabParamList, 'Profile'>

export default function ProfileScreen() {
  const navigation = useNavigation<ProfileNavigationProp>()
  const route = useRoute<ProfileRouteProp>()
  const openCalendar = () => navigation.navigate('Main', { screen: 'CalendarTab' })
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

  const quickActions = [
    {
      title: '今日签到',
      subtitle: '去日历完成今天安排',
      icon: 'calendar-check-outline',
      accent: colors.techDark,
      shell: 'rgba(220,236,238,0.92)',
      onPress: openCalendar,
    },
    {
      title: '编辑资料',
      subtitle: '统一调整阶段和关键日期',
      icon: 'account-edit-outline',
      accent: colors.primaryDark,
      shell: 'rgba(248,227,214,0.92)',
      onPress: openEditModal,
    },
    {
      title: '孕期档案',
      subtitle: '查看孕周、节点和本周记录',
      icon: 'file-document-outline',
      accent: colors.techDark,
      shell: 'rgba(230,242,245,0.9)',
      onPress: () => navigation.navigate('PregnancyProfile'),
    },
    {
      title: status === 'active' ? '管理会员' : '会员权益',
      subtitle: status === 'active' ? '查看周报与权益状态' : '开通后解锁增强能力',
      icon: 'crown-outline',
      accent: colors.ink,
      shell: 'rgba(255,249,243,0.92)',
      onPress: () => navigation.navigate('Membership'),
    },
  ]

  useEffect(() => {
    if (!route.params?.autoOpenEdit) {
      return
    }

    openEditModal()
    navigation.setParams({ autoOpenEdit: false })
  }, [navigation, openEditModal, route.params?.autoOpenEdit])

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

        <ContentSection style={styles.tightSection}>
          <StatsRow
            usageLabel={usageLabel}
            checkInStreak={checkInStreak}
            weeklyCompletionRate={weeklyCompletionRate}
          />
        </ContentSection>

        <ContentSection style={styles.tightSection}>
          <LinearGradient
            colors={['rgba(220,236,238,0.92)', 'rgba(235,245,247,0.94)', 'rgba(250,252,253,0.98)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.stageFocusCard}
          >
            <View style={styles.stageFocusGlow} />
            <View style={styles.stageFocusHeader}>
              <View style={styles.stageFocusIconShell}>
                <MaterialCommunityIcons name="radar" size={18} color={colors.techDark} />
              </View>
              <View style={styles.stageFocusTextWrap}>
                <Text style={styles.stageFocusEyebrow}>当前阶段重点</Text>
                <Text style={styles.stageFocusTitle}>{stage.focusTitle}</Text>
              </View>
            </View>
            <Text style={styles.stageFocusText}>{stage.reminder}</Text>
            <TouchableOpacity
              style={styles.stageFocusAction}
              activeOpacity={0.88}
              onPress={openCalendar}
            >
              <Text style={styles.stageFocusActionText}>去日历安排本周重点</Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color={colors.techDark} />
            </TouchableOpacity>
          </LinearGradient>
        </ContentSection>

        <ContentSection style={styles.tightSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>账户资料</Text>
            <Text style={styles.sectionMeta}>关键信息一页查看</Text>
          </View>
          <AccountInfo rows={accountRows} onPress={openEditModal} />
        </ContentSection>

        <ContentSection style={styles.tightSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>档案入口</Text>
            <Text style={styles.sectionMeta}>详情单独展开</Text>
          </View>
          <View style={styles.archiveGrid}>
            <TouchableOpacity style={styles.archiveEntryCard} activeOpacity={0.9} onPress={() => navigation.navigate('PregnancyProfile')}>
              <LinearGradient
                colors={['rgba(220,236,238,0.92)', 'rgba(203,225,229,0.92)', 'rgba(247,250,252,0.98)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.archiveEntryGradient}
              >
                <View style={styles.archiveEntryGlow} />
                <Text style={styles.archiveEntryEyebrow}>孕期专用</Text>
                <Text style={styles.archiveEntryTitle}>孕期档案</Text>
                <Text style={styles.archiveEntryText} numberOfLines={3}>
                  当前孕周、关键节点和本周记录集中查看。
                </Text>
                <View style={styles.archiveEntryFooter}>
                  <Text style={styles.archiveEntryAction}>查看档案</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={colors.techDark} />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.archiveEntryCard} activeOpacity={0.9} onPress={() => navigation.navigate('FamilyProfile')}>
              <LinearGradient
                colors={['rgba(248,227,214,0.96)', 'rgba(241,209,191,0.92)', 'rgba(250,244,238,0.98)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.archiveEntryGradient}
              >
                <View style={styles.archiveEntryGlow} />
                <Text style={styles.archiveEntryEyebrow}>长期视图</Text>
                <Text style={styles.archiveEntryTitle}>家庭档案</Text>
                <Text style={styles.archiveEntryText} numberOfLines={3}>
                  生命周期时间轴、家庭信息和关注点汇总。
                </Text>
                <View style={styles.archiveEntryFooter}>
                  <Text style={[styles.archiveEntryAction, styles.archiveEntryActionInk]}>查看档案</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={colors.ink} />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ContentSection>

        <ContentSection style={styles.tightSection}>
          <WeeklyReportList
            reports={weeklyReports}
            status={status}
            onViewMore={() =>
              navigation.navigate(status === 'active' ? 'WeeklyReport' : 'Membership')
            }
          />
        </ContentSection>

        <ContentSection style={styles.tightSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>快捷管理</Text>
            <Text style={styles.sectionMeta}>常用功能</Text>
          </View>
          <View style={styles.quickActionGrid}>
            {quickActions.map((item) => {
              const quickActionIconShellStyle = [styles.quickActionIconShell, { backgroundColor: item.shell }]

              return (
                <TouchableOpacity
                  key={item.title}
                  style={styles.quickActionCard}
                  onPress={item.onPress}
                  activeOpacity={0.88}
                >
                  <View style={quickActionIconShellStyle}>
                    <MaterialCommunityIcons name={item.icon} size={18} color={item.accent} />
                  </View>
                  <Text style={styles.quickActionTitle}>{item.title}</Text>
                  <Text style={styles.quickActionSubtitle}>{item.subtitle}</Text>
                  <View style={styles.quickActionFooter}>
                    <Text style={styles.quickActionCta}>去查看</Text>
                    <MaterialCommunityIcons name="chevron-right" size={18} color={colors.primaryDark} />
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
        </ContentSection>

        <ContentSection style={styles.tightSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>成长档案</Text>
            <Text style={styles.sectionMeta}>
              {status === 'active' ? '会员增强能力' : '基础版'}
            </Text>
          </View>
          <GrowthArchiveCard
            status={status}
            onPress={() => navigation.navigate('GrowthArchive')}
          />
        </ContentSection>

        <ContentSection style={styles.tightSection}>
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
    paddingBottom: TAB_SCROLL_BOTTOM_GAP,
  },
  headerSection: {
    marginTop: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  tightSection: {
    marginBottom: spacing.sm,
  },
  stageFocusCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.sm + 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.12)',
  },
  stageFocusGlow: {
    position: 'absolute',
    top: -18,
    right: -12,
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgba(255,255,255,0.36)',
  },
  stageFocusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs + 2,
  },
  stageFocusIconShell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(94,126,134,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageFocusTextWrap: {
    flex: 1,
  },
  stageFocusEyebrow: {
    color: colors.techDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  stageFocusTitle: {
    color: colors.inkDeep,
    fontSize: fontSize.md,
    fontWeight: '700',
    marginTop: 1,
  },
  stageFocusText: {
    color: colors.inkSoft,
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
  stageFocusAction: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(94,126,134,0.1)',
  },
  stageFocusActionText: {
    color: colors.techDark,
    fontSize: fontSize.sm,
    fontWeight: '700',
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
  quickActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 2,
  },
  quickActionCard: {
    width: '48%',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 3,
    backgroundColor: 'rgba(255, 249, 244, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(94, 126, 134, 0.12)',
    minHeight: 98,
  },
  quickActionIconShell: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  quickActionTitle: {
    color: colors.inkDeep,
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginBottom: 1,
  },
  quickActionSubtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    lineHeight: 15,
  },
  quickActionFooter: {
    marginTop: 'auto',
    paddingTop: spacing.xs + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickActionCta: {
    color: colors.primaryDark,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  archiveGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  archiveEntryCard: {
    width: '48%',
    overflow: 'hidden',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(185,104,66,0.14)',
  },
  archiveEntryGradient: {
    minHeight: 134,
    padding: spacing.sm,
    overflow: 'hidden',
  },
  archiveEntryGlow: {
    position: 'absolute',
    top: -22,
    right: -14,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,248,242,0.44)',
  },
  archiveEntryEyebrow: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  archiveEntryTitle: {
    color: colors.inkDeep,
    fontSize: fontSize.md,
    fontWeight: '800',
    marginBottom: 2,
  },
  archiveEntryText: {
    color: colors.inkSoft,
    fontSize: fontSize.xs,
    lineHeight: 16,
    maxWidth: '92%',
  },
  archiveEntryFooter: {
    marginTop: 'auto',
    paddingTop: spacing.xs + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  archiveEntryAction: {
    color: colors.techDark,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  archiveEntryActionInk: {
    color: colors.ink,
  },
  logoutButton: {
    marginTop: spacing.sm,
    borderColor: colors.red,
  },
})
