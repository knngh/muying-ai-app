import React, { useEffect, useState } from 'react'
import { Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import { Button, Modal, Portal, Text, TextInput } from 'react-native-paper'
import DateTimePicker from '@react-native-community/datetimepicker'
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import dayjs from 'dayjs'
import { colors, fontSize, spacing, borderRadius } from '../../theme'

const PREGNANCY_STATUSES = ['备孕中', '孕期中', '育儿中']
const GENDER_OPTIONS = ['男', '女', '未知']
const CAREGIVER_ROLE_OPTIONS = ['妈妈', '爸爸', '祖辈', '其他', '未知']
const CHILDBIRTH_MODE_OPTIONS = ['顺产', '剖宫产', '未知']
const FEEDING_MODE_OPTIONS = ['母乳', '配方奶', '混合喂养', '辅食为主', '未知']

interface EditProfileModalProps {
  visible: boolean
  nickname: string
  pregnancyStatus: string
  dueDate: string
  babyBirthday: string
  babyGender: string
  caregiverRole: string
  childNickname: string
  childBirthMode: string
  feedingMode: string
  developmentConcerns: string
  familyNotes: string
  onChangeNickname: (v: string) => void
  onChangePregnancyStatus: (v: string) => void
  onChangeDueDate: (v: string) => void
  onChangeBabyBirthday: (v: string) => void
  onChangeBabyGender: (v: string) => void
  onChangeCaregiverRole: (v: string) => void
  onChangeChildNickname: (v: string) => void
  onChangeChildBirthMode: (v: string) => void
  onChangeFeedingMode: (v: string) => void
  onChangeDevelopmentConcerns: (v: string) => void
  onChangeFamilyNotes: (v: string) => void
  onSave: () => void
  onDismiss: () => void
}

export default function EditProfileModal({
  visible,
  nickname,
  pregnancyStatus,
  dueDate,
  babyBirthday,
  babyGender,
  caregiverRole,
  childNickname,
  childBirthMode,
  feedingMode,
  developmentConcerns,
  familyNotes,
  onChangeNickname,
  onChangePregnancyStatus,
  onChangeDueDate,
  onChangeBabyBirthday,
  onChangeBabyGender,
  onChangeCaregiverRole,
  onChangeChildNickname,
  onChangeChildBirthMode,
  onChangeFeedingMode,
  onChangeDevelopmentConcerns,
  onChangeFamilyNotes,
  onSave,
  onDismiss,
}: EditProfileModalProps) {
  const [showDueDatePicker, setShowDueDatePicker] = useState(false)
  const [showBabyBirthdayPicker, setShowBabyBirthdayPicker] = useState(false)
  const isPregnancyStage = pregnancyStatus === '孕期中'
  const isParentingStage = pregnancyStatus === '育儿中'

  useEffect(() => {
    if (visible) {
      return
    }

    setShowDueDatePicker(false)
    setShowBabyBirthdayPicker(false)
  }, [visible])

  useEffect(() => {
    if (!isPregnancyStage && showDueDatePicker) {
      setShowDueDatePicker(false)
    }
    if (!isParentingStage && showBabyBirthdayPicker) {
      setShowBabyBirthdayPicker(false)
    }
  }, [isParentingStage, isPregnancyStage, showBabyBirthdayPicker, showDueDatePicker])

  const parseDateOrNow = (dateStr: string) => {
    const parsed = dayjs(dateStr)
    return parsed.isValid() ? parsed.toDate() : new Date()
  }

  const handleDueDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowDueDatePicker(false)
    if (selectedDate) {
      onChangeDueDate(dayjs(selectedDate).format('YYYY-MM-DD'))
    }
  }

  const handleBabyBirthdayChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowBabyBirthdayPicker(false)
    if (selectedDate) {
      onChangeBabyBirthday(dayjs(selectedDate).format('YYYY-MM-DD'))
    }
  }

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modalContainer}
      >
        <ScrollView>
          <Text style={styles.modalTitle}>编辑资料</Text>

          <TextInput
            label="昵称"
            value={nickname}
            onChangeText={onChangeNickname}
            mode="outlined"
            style={styles.input}
            activeOutlineColor={colors.primary}
          />

          <Text style={styles.fieldLabel}>当前阶段</Text>
          <View style={styles.optionRow}>
            {PREGNANCY_STATUSES.map((statusLabel) => (
              <TouchableOpacity
                key={statusLabel}
                onPress={() => onChangePregnancyStatus(statusLabel)}
                style={[
                  styles.optionButton,
                  pregnancyStatus === statusLabel && styles.optionButtonSelected,
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    pregnancyStatus === statusLabel && styles.optionTextSelected,
                  ]}
                >
                  {statusLabel}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {isPregnancyStage ? (
            <>
              <Text style={styles.fieldLabel}>预产期</Text>
              <Text style={styles.fieldHint}>选择孕期中时会使用预产期自动判断孕早、中、晚期。</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDueDatePicker(true)}
              >
                <Text style={dueDate ? styles.dateText : styles.datePlaceholder}>
                  {dueDate || '点击选择预产期'}
                </Text>
              </TouchableOpacity>
              {showDueDatePicker && (
                <View>
                  <DateTimePicker
                    value={parseDateOrNow(dueDate)}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleDueDateChange}
                  />
                  {Platform.OS === 'ios' && (
                    <Button mode="text" onPress={() => setShowDueDatePicker(false)}>
                      确定
                    </Button>
                  )}
                </View>
              )}
            </>
          ) : null}

          <Text style={styles.fieldLabel}>照护者角色</Text>
          <View style={styles.optionRow}>
            {CAREGIVER_ROLE_OPTIONS.map((role) => (
              <TouchableOpacity
                key={role}
                onPress={() => onChangeCaregiverRole(role)}
                style={[
                  styles.optionButton,
                  caregiverRole === role && styles.optionButtonSelected,
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    caregiverRole === role && styles.optionTextSelected,
                  ]}
                >
                  {role}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {isParentingStage ? (
            <>
              <TextInput
                label="孩子昵称"
                value={childNickname}
                onChangeText={onChangeChildNickname}
                mode="outlined"
                style={styles.input}
                activeOutlineColor={colors.primary}
              />

              <Text style={styles.fieldLabel}>宝宝生日</Text>
              <Text style={styles.fieldHint}>选择育儿中后，App 会根据宝宝生日自动切换到新生儿、0-6月、1-3岁和 3 岁以上阶段。</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowBabyBirthdayPicker(true)}
              >
                <Text style={babyBirthday ? styles.dateText : styles.datePlaceholder}>
                  {babyBirthday || '点击选择宝宝生日'}
                </Text>
              </TouchableOpacity>
              {showBabyBirthdayPicker && (
                <View>
                  <DateTimePicker
                    value={parseDateOrNow(babyBirthday)}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleBabyBirthdayChange}
                  />
                  {Platform.OS === 'ios' && (
                    <Button mode="text" onPress={() => setShowBabyBirthdayPicker(false)}>
                      确定
                    </Button>
                  )}
                </View>
              )}

              <Text style={styles.fieldLabel}>宝宝性别</Text>
              <View style={styles.optionRow}>
                {GENDER_OPTIONS.map((gender) => (
                  <TouchableOpacity
                    key={gender}
                    onPress={() => onChangeBabyGender(gender)}
                    style={[
                      styles.optionButton,
                      babyGender === gender && styles.optionButtonSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        babyGender === gender && styles.optionTextSelected,
                      ]}
                    >
                      {gender}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>分娩方式</Text>
              <View style={styles.optionRow}>
                {CHILDBIRTH_MODE_OPTIONS.map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    onPress={() => onChangeChildBirthMode(mode)}
                    style={[
                      styles.optionButton,
                      childBirthMode === mode && styles.optionButtonSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        childBirthMode === mode && styles.optionTextSelected,
                      ]}
                    >
                      {mode}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>喂养方式</Text>
              <View style={styles.optionRow}>
                {FEEDING_MODE_OPTIONS.map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    onPress={() => onChangeFeedingMode(mode)}
                    style={[
                      styles.optionButton,
                      feedingMode === mode && styles.optionButtonSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        feedingMode === mode && styles.optionTextSelected,
                      ]}
                    >
                      {mode}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                label="发育关注点"
                value={developmentConcerns}
                onChangeText={onChangeDevelopmentConcerns}
                mode="outlined"
                multiline
                numberOfLines={3}
                style={styles.input}
                activeOutlineColor={colors.primary}
                placeholder="例如：夜醒、语言发展、挑食、如厕训练"
              />
            </>
          ) : null}

          <TextInput
            label="家庭备注"
            value={familyNotes}
            onChangeText={onChangeFamilyNotes}
            mode="outlined"
            multiline
            numberOfLines={4}
            style={styles.input}
            activeOutlineColor={colors.primary}
            placeholder="例如：主要照护节奏、家庭协作分工、长期观察重点"
          />

          <View style={styles.modalActions}>
            <Button mode="text" onPress={onDismiss}>
              取消
            </Button>
            <Button mode="contained" buttonColor={colors.ink} onPress={onSave}>
              保存
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  )
}

const styles = StyleSheet.create({
  modalContainer: {
    margin: spacing.md,
    maxHeight: '84%',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    backgroundColor: colors.white,
  },
  modalTitle: {
    marginBottom: spacing.md,
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.text,
  },
  input: {
    marginBottom: spacing.sm,
    backgroundColor: colors.white,
  },
  fieldLabel: {
    marginBottom: spacing.xs,
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  fieldHint: {
    marginBottom: spacing.xs,
    color: colors.textLight,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  optionRow: {
    marginBottom: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  optionButton: {
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  optionButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  optionText: {
    color: colors.text,
    fontSize: fontSize.sm,
  },
  optionTextSelected: {
    color: colors.white,
    fontSize: fontSize.sm,
  },
  dateButton: {
    marginBottom: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.white,
  },
  dateText: {
    color: colors.text,
    fontSize: fontSize.md,
  },
  datePlaceholder: {
    color: colors.textLight,
    fontSize: fontSize.md,
  },
  modalActions: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
})
