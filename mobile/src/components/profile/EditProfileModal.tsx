import React, { useState } from 'react'
import { Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import { Button, Modal, Portal, Text, TextInput } from 'react-native-paper'
import DateTimePicker from '@react-native-community/datetimepicker'
import dayjs from 'dayjs'
import { colors, fontSize, spacing, borderRadius } from '../../theme'

const PREGNANCY_STATUSES = ['备孕中', '孕期中', '产后']
const GENDER_OPTIONS = ['男', '女', '未知']

interface EditProfileModalProps {
  visible: boolean
  nickname: string
  pregnancyStatus: string
  dueDate: string
  babyBirthday: string
  babyGender: string
  onChangeNickname: (v: string) => void
  onChangePregnancyStatus: (v: string) => void
  onChangeDueDate: (v: string) => void
  onChangeBabyBirthday: (v: string) => void
  onChangeBabyGender: (v: string) => void
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
  onChangeNickname,
  onChangePregnancyStatus,
  onChangeDueDate,
  onChangeBabyBirthday,
  onChangeBabyGender,
  onSave,
  onDismiss,
}: EditProfileModalProps) {
  const [showDueDatePicker, setShowDueDatePicker] = useState(false)
  const [showBabyBirthdayPicker, setShowBabyBirthdayPicker] = useState(false)

  const parseDateOrNow = (dateStr: string) => {
    const parsed = dayjs(dateStr)
    return parsed.isValid() ? parsed.toDate() : new Date()
  }

  const handleDueDateChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowDueDatePicker(false)
    if (selectedDate) {
      onChangeDueDate(dayjs(selectedDate).format('YYYY-MM-DD'))
    }
  }

  const handleBabyBirthdayChange = (_event: any, selectedDate?: Date) => {
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

          <Text style={styles.fieldLabel}>孕育状态</Text>
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

          <Text style={styles.fieldLabel}>预产期</Text>
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

          <Text style={styles.fieldLabel}>宝宝生日</Text>
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
    padding: spacing.lg,
    backgroundColor: colors.white,
  },
  modalTitle: {
    marginBottom: spacing.lg,
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.text,
  },
  input: {
    marginBottom: spacing.md,
    backgroundColor: colors.white,
  },
  fieldLabel: {
    marginBottom: spacing.xs,
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  optionRow: {
    marginBottom: spacing.md,
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
    marginBottom: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
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
