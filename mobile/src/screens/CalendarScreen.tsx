import React, { useCallback, useMemo, useState } from 'react'
import { Alert, SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Calendar, type DateData } from 'react-native-calendars'
import dayjs from 'dayjs'
import { Button, Card, Chip, IconButton, Modal, Portal, Switch, Text, TextInput } from 'react-native-paper'
import { useCalendarStore } from '../stores/calendarStore'
import { useMembershipStore } from '../stores/membershipStore'
import { colors, fontSize, spacing, borderRadius } from '../theme'

type EventType = 'checkup' | 'vaccine' | 'reminder' | 'other'

const EVENT_TYPE_CONFIG: Record<EventType, { label: string; color: string }> = {
  checkup: { label: '产检', color: colors.orange },
  vaccine: { label: '疫苗', color: colors.green },
  reminder: { label: '提醒', color: colors.primary },
  other: { label: '其他', color: colors.textSecondary },
}

const EVENT_TYPES: EventType[] = ['checkup', 'vaccine', 'reminder', 'other']

interface CalendarEventView {
  id: number
  title: string
  description?: string
  eventDate: string
  eventType: EventType
  reminderEnabled: boolean
  isCompleted: boolean
}

export default function CalendarScreen() {
  const {
    events = [],
    currentMonth,
    setCurrentMonth,
    fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    completeEvent,
  } = useCalendarStore()
  const { checkInStreak, weeklyCompletionRate, ensureFreshQuota } = useMembershipStore()

  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [modalVisible, setModalVisible] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEventView | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formType, setFormType] = useState<EventType>('reminder')
  const [formReminder, setFormReminder] = useState(true)

  useFocusEffect(
    useCallback(() => {
      const start = dayjs(currentMonth).startOf('month').format('YYYY-MM-DD')
      const end = dayjs(currentMonth).endOf('month').format('YYYY-MM-DD')
      fetchEvents(start, end)
      ensureFreshQuota()
    }, [currentMonth, ensureFreshQuota, fetchEvents]),
  )

  const calendarEvents = events as unknown as CalendarEventView[]

  const markedDates = useMemo(() => {
    const marks: Record<string, { dots?: Array<{ key: number; color: string }>; marked?: boolean; selected?: boolean; selectedColor?: string }> = {}

    calendarEvents.forEach((event) => {
      const color = EVENT_TYPE_CONFIG[event.eventType]?.color ?? colors.textSecondary
      if (!marks[event.eventDate]) {
        marks[event.eventDate] = { dots: [], marked: true }
      }
      marks[event.eventDate].dots?.push({ key: event.id, color })
    })

    marks[selectedDate] = {
      ...(marks[selectedDate] || {}),
      selected: true,
      selectedColor: colors.primaryLight,
    }

    return marks
  }, [calendarEvents, selectedDate])

  const eventsForSelectedDate = useMemo(
    () => calendarEvents.filter((event) => event.eventDate === selectedDate),
    [calendarEvents, selectedDate],
  )

  const completedToday = eventsForSelectedDate.filter((event) => event.isCompleted).length
  const pendingToday = Math.max(eventsForSelectedDate.length - completedToday, 0)

  const onDayPress = useCallback((day: DateData) => {
    setSelectedDate(day.dateString)
  }, [])

  const onMonthChange = useCallback((day: DateData) => {
    setCurrentMonth(day.dateString.slice(0, 7))
  }, [setCurrentMonth])

  const openCreateModal = useCallback(() => {
    setEditingEvent(null)
    setFormTitle('')
    setFormDescription('')
    setFormType('reminder')
    setFormReminder(true)
    setModalVisible(true)
  }, [])

  const openEditModal = useCallback((event: CalendarEventView) => {
    setEditingEvent(event)
    setFormTitle(event.title)
    setFormDescription(event.description || '')
    setFormType(event.eventType)
    setFormReminder(event.reminderEnabled)
    setModalVisible(true)
  }, [])

  const handleSave = useCallback(async () => {
    if (!formTitle.trim()) {
      Alert.alert('提示', '请输入事件标题')
      return
    }

    if (editingEvent) {
      await updateEvent(editingEvent.id, {
        title: formTitle.trim(),
        description: formDescription.trim(),
        eventType: formType,
        reminderEnabled: formReminder,
      })
    } else {
      await createEvent({
        title: formTitle.trim(),
        description: formDescription.trim(),
        eventDate: selectedDate,
        eventType: formType,
        reminderEnabled: formReminder,
        isCompleted: false,
      })
    }

    setModalVisible(false)
  }, [createEvent, editingEvent, formDescription, formReminder, formTitle, formType, selectedDate, updateEvent])

  const handleDelete = useCallback((event: CalendarEventView) => {
    Alert.alert('确认删除', `确定要删除“${event.title}”吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          deleteEvent(event.id)
        },
      },
    ])
  }, [deleteEvent])

  const handleComplete = useCallback(async (event: CalendarEventView) => {
    if (event.isCompleted) {
      await updateEvent(event.id, { isCompleted: false })
      return
    }

    await completeEvent(event.id)
  }, [completeEvent, updateEvent])

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>孕育日历</Text>
            <Text style={styles.headerSubtitle}>把产检、提醒和打卡放到同一个节奏里。</Text>
          </View>
          <Button mode="contained" icon="plus" onPress={openCreateModal} buttonColor={colors.ink}>
            添加事件
          </Button>
        </View>

        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Card.Content>
              <Text style={styles.statLabel}>连续打卡</Text>
              <Text style={styles.statValue}>{checkInStreak} 天</Text>
            </Card.Content>
          </Card>
          <Card style={styles.statCard}>
            <Card.Content>
              <Text style={styles.statLabel}>本周完成率</Text>
              <Text style={styles.statValue}>{weeklyCompletionRate}%</Text>
            </Card.Content>
          </Card>
          <Card style={styles.statCard}>
            <Card.Content>
              <Text style={styles.statLabel}>今日待办</Text>
              <Text style={styles.statValue}>{pendingToday} 项</Text>
            </Card.Content>
          </Card>
        </View>

        <Card style={styles.calendarCard}>
          <Card.Content>
            <Calendar
              current={selectedDate}
              onDayPress={onDayPress}
              onMonthChange={onMonthChange}
              markingType="multi-dot"
              markedDates={markedDates}
              theme={{
                todayTextColor: colors.primary,
                selectedDayBackgroundColor: colors.ink,
                arrowColor: colors.ink,
              }}
            />
          </Card.Content>
        </Card>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>{dayjs(selectedDate).format('YYYY年MM月DD日')} 的事件</Text>
            <Text style={styles.sectionMeta}>已完成 {completedToday} 项，待处理 {pendingToday} 项</Text>
          </View>
        </View>

        {eventsForSelectedDate.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text style={styles.emptyTitle}>这一天还没有安排事件</Text>
              <Text style={styles.emptyText}>可以补一个产检提醒、疫苗计划或日常打卡。</Text>
            </Card.Content>
          </Card>
        ) : (
          eventsForSelectedDate.map((event) => {
            const typeConfig = EVENT_TYPE_CONFIG[event.eventType]
            return (
              <Card key={event.id} style={[styles.eventCard, event.isCompleted && styles.eventCardCompleted]}>
                <Card.Content>
                  <View style={styles.eventHeader}>
                    <View style={styles.eventTitleRow}>
                      <Text style={[styles.eventTitle, event.isCompleted && styles.eventTitleCompleted]}>
                        {event.title}
                      </Text>
                      <Chip compact style={[styles.typeChip, { backgroundColor: `${typeConfig.color}20` }]} textStyle={[styles.typeChipText, { color: typeConfig.color }]}>
                        {typeConfig.label}
                      </Chip>
                    </View>
                    <Text style={styles.eventDate}>{dayjs(event.eventDate).format('YYYY-MM-DD')}</Text>
                  </View>

                  {event.description ? (
                    <Text style={styles.eventDescription}>{event.description}</Text>
                  ) : null}

                  <View style={styles.eventActions}>
                    <Button
                      compact
                      mode="text"
                      icon={event.isCompleted ? 'check-circle' : 'circle-outline'}
                      onPress={() => handleComplete(event)}
                      textColor={event.isCompleted ? colors.green : colors.textLight}
                    >
                      {event.isCompleted ? '已完成' : '完成'}
                    </Button>
                    <IconButton icon="pencil" size={18} onPress={() => openEditModal(event)} />
                    <IconButton icon="delete" size={18} iconColor={colors.red} onPress={() => handleDelete(event)} />
                  </View>
                </Card.Content>
              </Card>
            )
          })
        )}
      </ScrollView>

      <Portal>
        <Modal visible={modalVisible} onDismiss={() => setModalVisible(false)} contentContainerStyle={styles.modalContainer}>
          <ScrollView>
            <Text style={styles.modalTitle}>{editingEvent ? '编辑事件' : '新建事件'}</Text>

            <TextInput
              label="标题"
              value={formTitle}
              onChangeText={setFormTitle}
              mode="outlined"
              style={styles.input}
              activeOutlineColor={colors.primary}
            />

            <TextInput
              label="描述"
              value={formDescription}
              onChangeText={setFormDescription}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.input}
              activeOutlineColor={colors.primary}
            />

            <Text style={styles.fieldLabel}>日期：{dayjs(selectedDate).format('YYYY年MM月DD日')}</Text>
            <Text style={styles.fieldLabel}>类型</Text>

            <View style={styles.typePicker}>
              {EVENT_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setFormType(type)}
                  style={[
                    styles.typeOption,
                    { backgroundColor: formType === type ? EVENT_TYPE_CONFIG[type].color : colors.background },
                  ]}
                >
                  <Text style={[styles.typeOptionText, formType === type && styles.typeOptionTextSelected]}>
                    {EVENT_TYPE_CONFIG[type].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.reminderRow}>
              <Text style={styles.fieldLabel}>开启提醒</Text>
              <Switch value={formReminder} onValueChange={setFormReminder} color={colors.primary} />
            </View>

            <Button mode="contained" onPress={handleSave} style={styles.saveButton} buttonColor={colors.ink}>
              保存
            </Button>
            <Button mode="text" onPress={() => setModalVisible(false)}>
              取消
            </Button>
          </ScrollView>
        </Modal>
      </Portal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  headerTitle: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    marginTop: spacing.xs,
    color: colors.textLight,
  },
  statsRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.white,
  },
  statLabel: {
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
  },
  calendarCard: {
    marginTop: spacing.lg,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.white,
  },
  sectionHeader: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
  },
  sectionMeta: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
  },
  emptyCard: {
    borderRadius: borderRadius.xl,
    backgroundColor: colors.white,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  emptyText: {
    marginTop: spacing.sm,
    color: colors.textLight,
    lineHeight: 22,
  },
  eventCard: {
    marginBottom: spacing.sm,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.white,
  },
  eventCardCompleted: {
    opacity: 0.68,
  },
  eventHeader: {
    marginBottom: spacing.xs,
  },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  eventTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  eventTitleCompleted: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
  },
  typeChip: {
    alignSelf: 'flex-start',
  },
  typeChipText: {
    fontWeight: '700',
  },
  eventDate: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  eventDescription: {
    marginTop: spacing.sm,
    color: colors.textLight,
    lineHeight: 22,
  },
  eventActions: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalContainer: {
    margin: spacing.md,
    maxHeight: '82%',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    backgroundColor: colors.white,
  },
  modalTitle: {
    marginBottom: spacing.md,
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text,
  },
  input: {
    marginBottom: spacing.md,
    backgroundColor: colors.white,
  },
  fieldLabel: {
    marginBottom: spacing.sm,
    color: colors.text,
  },
  typePicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  typeOption: {
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  typeOptionText: {
    color: colors.text,
  },
  typeOptionTextSelected: {
    color: colors.white,
  },
  reminderRow: {
    marginVertical: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  saveButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.pill,
  },
})
