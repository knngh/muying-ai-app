import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Animated,
  PanResponder,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Calendar, type DateData } from 'react-native-calendars'
import dayjs from 'dayjs'
import { Button, Card, Chip, IconButton, Modal, Portal, Snackbar, Switch, Text, TextInput } from 'react-native-paper'
import LinearGradient from 'react-native-linear-gradient'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { useCalendarStore } from '../stores/calendarStore'
import { useAppStore } from '../stores/appStore'
import { useMembershipStore } from '../stores/membershipStore'
import { ScreenContainer, StandardCard } from '../components/layout'
import { getStageSummary, type CalendarSuggestion } from '../utils/stage'
import { borderRadius, colors, fontSize, spacing } from '../theme'

type EventType = 'checkup' | 'vaccine' | 'reminder' | 'exercise' | 'diet' | 'other'

const EVENT_TYPE_CONFIG: Record<EventType, { label: string; color: string; icon: string }> = {
  checkup: { label: '检查', color: colors.orange, icon: 'hospital-box-outline' },
  vaccine: { label: '疫苗', color: colors.green, icon: 'needle' },
  reminder: { label: '提醒', color: colors.primary, icon: 'bell-outline' },
  exercise: { label: '运动', color: colors.gold, icon: 'run-fast' },
  diet: { label: '饮食', color: colors.pink, icon: 'food-apple-outline' },
  other: { label: '其他', color: colors.textSecondary, icon: 'shape-outline' },
}

const EVENT_TYPES: EventType[] = ['checkup', 'vaccine', 'reminder', 'exercise', 'diet', 'other']
const DEFAULT_EVENT_TIME = '08:00'
const DEFAULT_REMINDER_MINUTES = 12 * 60
const DEFAULT_REMINDER_LABEL = '默认提醒：前一晚 20:00'

interface CalendarEventView {
  id: number
  title: string
  description?: string
  eventDate: string
  eventType: EventType
  reminderEnabled: boolean
  reminderMinutes?: number
  startTime?: string
  isCompleted: boolean
}

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

interface DayMark {
  dots?: Array<{ key: number; color: string }>
  marked?: boolean
  selected?: boolean
  selectedColor?: string
}

interface CalendarDayRenderProps {
  date?: DateData
  state?: string
  marking?: DayMark
}

interface DraggableSuggestionCardProps {
  suggestion: CalendarSuggestion
  actionLabel: string
  focusDateLabel: string
  selectedDateAllowed: boolean
  measureDateCells: () => void
  findDropDate: (x: number, y: number, suggestion: CalendarSuggestion) => string | null
  onAddToSelected: (suggestion: CalendarSuggestion) => void
  onFocusSuggestionWindow: (suggestion: CalendarSuggestion) => void
  onDragStart: (suggestion: CalendarSuggestion) => void
  onDragEnd: () => void
  onHoverDateChange: (date: string | null) => void
  onDropOnDate: (suggestion: CalendarSuggestion, targetDate: string) => void
}

function isPointInsideRect(x: number, y: number, rect: Rect) {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
}

function getSuggestionWindow(suggestion: CalendarSuggestion) {
  return {
    start: dayjs().startOf('day').add(suggestion.minOffsetDays, 'day'),
    end: dayjs().startOf('day').add(suggestion.maxOffsetDays, 'day'),
  }
}

function isDateWithinSuggestionWindow(dateString: string, suggestion: CalendarSuggestion) {
  const target = dayjs(dateString).startOf('day')
  const { start, end } = getSuggestionWindow(suggestion)
  return (target.isAfter(start) || target.isSame(start, 'day')) && (target.isBefore(end) || target.isSame(end, 'day'))
}

function formatSuggestionRange(suggestion: CalendarSuggestion) {
  const { start, end } = getSuggestionWindow(suggestion)
  return `${start.format('M月D日')} - ${end.format('M月D日')}`
}

function resolveSuggestionFocusDate(suggestion: CalendarSuggestion, referenceDate: string) {
  const target = dayjs(referenceDate).startOf('day')
  const { start, end } = getSuggestionWindow(suggestion)

  if (target.isBefore(start, 'day')) {
    return start.format('YYYY-MM-DD')
  }

  if (target.isAfter(end, 'day')) {
    return end.format('YYYY-MM-DD')
  }

  return target.format('YYYY-MM-DD')
}

function resolveSelectedDateForMonth(nextMonth: string, previousSelectedDate: string) {
  const monthStart = dayjs(`${nextMonth}-01`).startOf('month')
  const preferredDay = dayjs(previousSelectedDate).date()
  const clampedDay = Math.min(preferredDay, monthStart.daysInMonth())
  return monthStart.date(clampedDay).format('YYYY-MM-DD')
}

function DraggableSuggestionCard({
  suggestion,
  actionLabel,
  focusDateLabel,
  selectedDateAllowed,
  measureDateCells,
  findDropDate,
  onAddToSelected,
  onFocusSuggestionWindow,
  onDragStart,
  onDragEnd,
  onHoverDateChange,
  onDropOnDate,
}: DraggableSuggestionCardProps) {
  const pan = useRef(new Animated.ValueXY()).current
  const draggingRef = useRef(false)

  const resetPosition = useCallback(() => {
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
      bounciness: 5,
    }).start(() => {
      draggingRef.current = false
      onHoverDateChange(null)
      onDragEnd()
    })
  }, [onDragEnd, onHoverDateChange, pan])

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          draggingRef.current = true
          measureDateCells()
          onDragStart(suggestion)
        },
        onPanResponderMove: (_, gestureState) => {
          pan.setValue({ x: gestureState.dx, y: gestureState.dy })
          onHoverDateChange(findDropDate(gestureState.moveX, gestureState.moveY, suggestion))
        },
        onPanResponderRelease: (_, gestureState) => {
          const droppedDate = findDropDate(gestureState.moveX, gestureState.moveY, suggestion)
          if (droppedDate) {
            onDropOnDate(suggestion, droppedDate)
          }
          resetPosition()
        },
        onPanResponderTerminate: () => {
          resetPosition()
        },
      }),
    [findDropDate, measureDateCells, onDragStart, onDropOnDate, onHoverDateChange, pan, resetPosition, suggestion],
  )

  return (
    <Animated.View
      style={[
        styles.suggestionCardWrap,
        draggingRef.current && styles.suggestionCardWrapDragging,
        { transform: pan.getTranslateTransform() },
      ]}
    >
      <View style={styles.suggestionCard}>
        <View style={styles.suggestionEyebrowRow}>
          <View style={styles.suggestionLead}>
            <View style={styles.suggestionIconShell}>
              <MaterialCommunityIcons
                name={EVENT_TYPE_CONFIG[suggestion.eventType].icon}
                size={16}
                color={colors.primaryDark}
              />
            </View>
            <View style={styles.suggestionLeadText}>
              <Text style={styles.suggestionEyebrow}>建议时间窗</Text>
              <Text style={styles.suggestionMiniLabel}>{suggestion.windowLabel}</Text>
            </View>
          </View>
          <View style={styles.dragHandle} {...panResponder.panHandlers}>
            <View style={styles.dragHandleBar} />
            <View style={styles.dragHandleBar} />
          </View>
        </View>

        <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
        <Text style={styles.suggestionDescription}>{suggestion.description}</Text>

        <View style={styles.suggestionChipRow}>
          <Chip compact style={styles.windowChip} textStyle={styles.windowChipText}>
            {suggestion.windowLabel}
          </Chip>
          <Chip compact style={styles.windowChip} textStyle={styles.windowChipText}>
            {suggestion.reminderLabel}
          </Chip>
        </View>

        <View style={styles.suggestionInfoBar}>
          <MaterialCommunityIcons name="calendar-range" size={15} color={colors.techDark} />
          <Text style={styles.suggestionRangeText}>可拖入 {formatSuggestionRange(suggestion)} 任意日期</Text>
        </View>
        {!selectedDateAllowed ? <Text style={styles.suggestionHint}>将日历定位到 {focusDateLabel} 后，可直接点按加入。</Text> : null}

        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => {
            if (selectedDateAllowed) {
              onAddToSelected(suggestion)
              return
            }

            onFocusSuggestionWindow(suggestion)
          }}
          style={[styles.suggestionActionButton, !selectedDateAllowed && styles.suggestionActionButtonSecondary]}
        >
          <Text style={[styles.suggestionAction, !selectedDateAllowed && styles.suggestionActionSecondary]}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  )
}

export default function CalendarScreen() {
  const user = useAppStore((state) => state.user)
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
  const stage = useMemo(() => getStageSummary(user), [user])

  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [modalVisible, setModalVisible] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEventView | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formType, setFormType] = useState<EventType>('reminder')
  const [formReminder, setFormReminder] = useState(true)
  const [draggingSuggestion, setDraggingSuggestion] = useState<CalendarSuggestion | null>(null)
  const [hoveredDate, setHoveredDate] = useState<string | null>(null)
  const [snackMessage, setSnackMessage] = useState('')
  const dateCellNodesRef = useRef<Record<string, View | null>>({})
  const dateCellRectsRef = useRef<Record<string, Rect>>({})

  useFocusEffect(
    useCallback(() => {
      const start = dayjs(currentMonth).startOf('month').format('YYYY-MM-DD')
      const end = dayjs(currentMonth).endOf('month').format('YYYY-MM-DD')
      fetchEvents(start, end)
      ensureFreshQuota()
    }, [currentMonth, ensureFreshQuota, fetchEvents]),
  )

  const calendarEvents = events as unknown as CalendarEventView[]
  const todayString = dayjs().format('YYYY-MM-DD')

  const markedDates = useMemo(() => {
    const marks: Record<string, DayMark> = {}

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
  const activeSuggestionWindow = draggingSuggestion ? formatSuggestionRange(draggingSuggestion) : null
  const selectedDateIsToday = selectedDate === todayString

  const measureDateCell = useCallback((dateString: string) => {
    requestAnimationFrame(() => {
      const node = dateCellNodesRef.current[dateString]
      node?.measureInWindow((x, y, width, height) => {
        dateCellRectsRef.current[dateString] = { x, y, width, height }
      })
    })
  }, [])

  const registerDateCell = useCallback((dateString: string, node: View | null) => {
    if (node) {
      dateCellNodesRef.current[dateString] = node
      measureDateCell(dateString)
      return
    }

    delete dateCellNodesRef.current[dateString]
    delete dateCellRectsRef.current[dateString]
  }, [measureDateCell])

  const measureDateCells = useCallback(() => {
    Object.keys(dateCellNodesRef.current).forEach((dateString) => {
      measureDateCell(dateString)
    })
  }, [measureDateCell])

  const findDropDate = useCallback((x: number, y: number, suggestion: CalendarSuggestion) => {
    for (const [dateString, rect] of Object.entries(dateCellRectsRef.current)) {
      if (isDateWithinSuggestionWindow(dateString, suggestion) && isPointInsideRect(x, y, rect)) {
        return dateString
      }
    }
    return null
  }, [])

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

  const createScheduledEvent = useCallback(async (
    suggestion: CalendarSuggestion,
    targetDate: string,
    source: 'tap' | 'drag',
  ) => {
    try {
      await createEvent({
        title: suggestion.title,
        description: suggestion.description,
        eventDate: targetDate,
        eventType: suggestion.eventType,
        startTime: DEFAULT_EVENT_TIME,
        reminderEnabled: true,
        reminderMinutes: DEFAULT_REMINDER_MINUTES,
        isCompleted: false,
      })

      setSelectedDate(targetDate)
      if (targetDate.slice(0, 7) !== currentMonth) {
        setCurrentMonth(targetDate.slice(0, 7))
      }

      setSnackMessage(
        source === 'drag'
          ? `已排入 ${dayjs(targetDate).format('MM-DD')}，默认前一晚 20:00 提醒`
          : `已加入 ${dayjs(targetDate).format('MM-DD')}`,
      )
    } catch (_error) {
      setSnackMessage('添加失败，请稍后重试')
    }
  }, [createEvent, currentMonth, setCurrentMonth])

  const handleAddSuggestionToSelected = useCallback((suggestion: CalendarSuggestion) => {
    if (!isDateWithinSuggestionWindow(selectedDate, suggestion)) {
      setSnackMessage(`当前日期不在建议时间窗内，请拖入 ${formatSuggestionRange(suggestion)} 高亮日期`)
      return
    }

    void createScheduledEvent(suggestion, selectedDate, 'tap')
  }, [createScheduledEvent, selectedDate])

  const handleDropSuggestion = useCallback((suggestion: CalendarSuggestion, targetDate: string) => {
    void createScheduledEvent(suggestion, targetDate, 'drag')
  }, [createScheduledEvent])

  const handleSave = useCallback(async () => {
    if (!formTitle.trim()) {
      Alert.alert('提示', '请输入事件标题')
      return
    }

    try {
      if (editingEvent) {
        await updateEvent(editingEvent.id, {
          title: formTitle.trim(),
          description: formDescription.trim(),
          eventType: formType,
          reminderEnabled: formReminder,
          reminderMinutes: formReminder ? DEFAULT_REMINDER_MINUTES : 0,
          startTime: editingEvent.startTime ?? DEFAULT_EVENT_TIME,
        })
      } else {
        await createEvent({
          title: formTitle.trim(),
          description: formDescription.trim(),
          eventDate: selectedDate,
          eventType: formType,
          reminderEnabled: formReminder,
          reminderMinutes: formReminder ? DEFAULT_REMINDER_MINUTES : 0,
          startTime: DEFAULT_EVENT_TIME,
          isCompleted: false,
        })
      }

      setModalVisible(false)
    } catch (_error) {
      Alert.alert('提示', '保存失败，请稍后重试')
    }
  }, [createEvent, editingEvent, formDescription, formReminder, formTitle, formType, selectedDate, updateEvent])

  const handleDelete = useCallback((event: CalendarEventView) => {
    Alert.alert('确认删除', `确定要删除“${event.title}”吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          void deleteEvent(event.id)
        },
      },
    ])
  }, [deleteEvent])

  const handleComplete = useCallback(async (event: CalendarEventView) => {
    try {
      if (event.isCompleted) {
        await updateEvent(event.id, { isCompleted: false })
        return
      }

      await completeEvent(event.id)
    } catch (_error) {
      setSnackMessage('状态更新失败，请稍后重试')
    }
  }, [completeEvent, updateEvent])

  const syncCalendarDate = useCallback((dateString: string) => {
    setSelectedDate(dateString)
    const nextMonth = dateString.slice(0, 7)
    if (nextMonth !== currentMonth) {
      setCurrentMonth(nextMonth)
    }
    setHoveredDate(null)
    setDraggingSuggestion(null)
  }, [currentMonth, setCurrentMonth])

  const onDayPress = useCallback((day: DateData) => {
    syncCalendarDate(day.dateString)
  }, [syncCalendarDate])

  const onMonthChange = useCallback((day: DateData) => {
    const nextMonth = day.dateString.slice(0, 7)
    const resolvedDate = resolveSelectedDateForMonth(nextMonth, selectedDate)
    setCurrentMonth(nextMonth)
    setSelectedDate(resolvedDate)
    setHoveredDate(null)
    setDraggingSuggestion(null)
  }, [selectedDate, setCurrentMonth])

  const handleFocusSuggestionWindow = useCallback((suggestion: CalendarSuggestion) => {
    const targetDate = resolveSuggestionFocusDate(suggestion, selectedDate)
    syncCalendarDate(targetDate)
    setSnackMessage(`已定位到 ${dayjs(targetDate).format('MM-DD')}，可拖入或点按加入`)
  }, [selectedDate, syncCalendarDate])

  const handleReturnToToday = useCallback(() => {
    syncCalendarDate(todayString)
  }, [syncCalendarDate, todayString])

  const renderDayCell = useCallback(({ date, state, marking }: CalendarDayRenderProps) => {
    if (!date) return <View style={styles.dayShell} />

    const dateString = date.dateString
    const isSelected = dateString === selectedDate
    const isToday = dateString === todayString
    const isInCurrentMonth = state !== 'disabled'
    const isAllowed = draggingSuggestion ? isDateWithinSuggestionWindow(dateString, draggingSuggestion) : false
    const isHovered = hoveredDate === dateString
    const dotColors = (marking?.dots || []).slice(0, 3).map((dot) => dot.color)

    return (
      <View
        ref={(node) => registerDateCell(dateString, node)}
        onLayout={() => measureDateCell(dateString)}
        style={styles.dayShell}
      >
        <TouchableOpacity activeOpacity={0.88} onPress={() => onDayPress(date)} style={styles.dayTouch}>
          <View
            style={[
              styles.dayCell,
              !isInCurrentMonth && styles.dayCellMuted,
              isSelected && styles.dayCellSelected,
              isAllowed && styles.dayCellAllowed,
              isHovered && styles.dayCellHover,
            ]}
          >
            <Text
              style={[
                styles.dayNumber,
                !isInCurrentMonth && styles.dayNumberMuted,
                isSelected && styles.dayNumberSelected,
                isAllowed && styles.dayNumberAllowed,
              ]}
            >
              {date.day}
            </Text>

            {isToday ? <View style={styles.todayDot} /> : null}

            <View style={styles.dayMetaRow}>
              {dotColors.length > 0 ? (
                <View style={styles.eventDots}>
                  {dotColors.map((color, index) => (
                    <View key={`${dateString}-${index}`} style={[styles.eventDot, { backgroundColor: color }]} />
                  ))}
                </View>
              ) : (
                <View />
              )}

              {isAllowed ? <Text style={styles.dropReadyText}>{isHovered ? '放下' : '可放'}</Text> : null}
            </View>
          </View>
        </TouchableOpacity>
      </View>
    )
  }, [draggingSuggestion, hoveredDate, measureDateCell, onDayPress, registerDateCell, selectedDate, todayString])

  return (
    <ScreenContainer style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <StandardCard style={styles.heroCard} elevation={2}>
          <LinearGradient
            colors={['#F8E3D6', '#EECBB7', '#F8F1E9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.heroGlow} />
            <View style={styles.heroRing} />
            <View style={styles.heroTop}>
              <View style={styles.heroTopText}>
                <View style={styles.heroChipRow}>
                  <Chip compact style={styles.heroChip} textStyle={styles.heroChipText}>
                    {stage.lifecycleLabel}
                  </Chip>
                  <Chip compact style={styles.heroAssistChip} textStyle={styles.heroAssistChipText}>
                    拖拽排程
                  </Chip>
                </View>
                <Text style={styles.headerTitle}>{stage.calendarTitle}</Text>
                <Text style={styles.headerSubtitle}>{stage.calendarSubtitle}</Text>
              </View>
              <Button
                mode="contained"
                icon="plus"
                onPress={openCreateModal}
                buttonColor={colors.ink}
                style={styles.heroActionButton}
              >
                添加安排
              </Button>
            </View>

            <View style={styles.heroSignalPanel}>
              <View style={styles.heroSignalItem}>
                <Text style={styles.heroSignalValue}>{dayjs(selectedDate).format('MM-DD')}</Text>
                <Text style={styles.heroSignalLabel}>当前日期</Text>
              </View>
              <View style={styles.heroSignalDivider} />
              <View style={styles.heroSignalItem}>
                <Text style={styles.heroSignalValue}>{pendingToday}</Text>
                <Text style={styles.heroSignalLabel}>待安排</Text>
              </View>
              <View style={styles.heroSignalDivider} />
              <View style={styles.heroSignalItem}>
                <Text style={styles.heroSignalValue}>{completedToday}</Text>
                <Text style={styles.heroSignalLabel}>已完成</Text>
              </View>
              <View style={styles.heroSignalDivider} />
              <View style={styles.heroSignalItem}>
                <Text style={styles.heroSignalValue}>{checkInStreak}天</Text>
                <Text style={styles.heroSignalLabel}>连续打卡</Text>
              </View>
            </View>
          </LinearGradient>
        </StandardCard>

        <View style={styles.statsRow}>
          {[
            { label: '当前阶段', value: stage.lifecycleLabel, icon: 'radar', tone: 'copper' },
            { label: '本周完成', value: `${weeklyCompletionRate}%`, icon: 'chart-arc', tone: 'green' },
            { label: '今日待办', value: `${pendingToday} 项`, icon: 'calendar-clock-outline', tone: 'tech' },
            { label: '已完成', value: `${completedToday} 项`, icon: 'check-decagram-outline', tone: 'gold' },
          ].map((item) => (
            <Card key={item.label} style={styles.statCard}>
              <Card.Content>
                <View
                  style={[
                    styles.statIconShell,
                    item.tone === 'green' && styles.statIconShellGreen,
                    item.tone === 'tech' && styles.statIconShellTech,
                    item.tone === 'gold' && styles.statIconShellGold,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={17}
                    color={
                      item.tone === 'green'
                        ? colors.green
                        : item.tone === 'tech'
                          ? colors.techDark
                          : item.tone === 'gold'
                            ? colors.gold
                            : colors.primaryDark
                    }
                  />
                </View>
                <Text style={styles.statLabel}>{item.label}</Text>
                <Text style={styles.statValue}>{item.value}</Text>
              </Card.Content>
            </Card>
          ))}
        </View>

        <Card style={styles.stageCard}>
          <LinearGradient colors={[colors.primaryLight, '#F3D9C8', '#FFF6EE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.stageGradient}>
            <Card.Content>
              <View style={styles.stageCardHeader}>
                <View style={styles.stageCardLead}>
                  <View style={styles.stageIconShell}>
                    <MaterialCommunityIcons name="radar" size={17} color={colors.techDark} />
                  </View>
                  <View style={styles.stageCardHeaderText}>
                    <Text style={styles.stageEyebrow}>阶段提示</Text>
                    <Text style={styles.stageCardTitle}>{stage.focusTitle}</Text>
                    <Text style={styles.stageCardSubtitle}>{stage.reminder}</Text>
                  </View>
                </View>
                <Chip compact style={styles.stageChip} textStyle={styles.stageChipText}>
                  {weeklyCompletionRate}% 完成
                </Chip>
              </View>

              <View style={styles.stageTagRow}>
                {stage.statusTags.slice(0, 3).map((tag) => (
                  <Chip key={tag} compact style={styles.stageTagChip} textStyle={styles.stageTagChipText}>
                    {tag}
                  </Chip>
                ))}
              </View>
            </Card.Content>
          </LinearGradient>
        </Card>

        <Card style={styles.engineCard}>
          <LinearGradient colors={['#3B2923', '#754534', '#DB9B65']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.engineGradient}>
            <View style={styles.engineGlow} />
            <Text style={styles.engineEyebrow}>拖拽安排</Text>
            <Text style={styles.engineTitle}>建议卡先给时间窗，再拖到窗口内任意日期</Text>
            <Text style={styles.engineDescription}>
              {draggingSuggestion
                ? `${draggingSuggestion.title}：${draggingSuggestion.windowLabel}，当前有效日期 ${activeSuggestionWindow}`
                : '拖动下方建议卡到高亮日期，系统默认在事件前一晚 20:00 提醒。'}
            </Text>

            <View style={styles.engineSignalPanel}>
              <View style={styles.engineSignalItem}>
                <Text style={styles.engineSignalValue}>{dayjs(selectedDate).format('MM-DD')}</Text>
                <Text style={styles.engineSignalLabel}>当前选中</Text>
              </View>
              <View style={styles.engineSignalDivider} />
              <View style={styles.engineSignalItem}>
                <Text style={styles.engineSignalValue}>{hoveredDate ? dayjs(hoveredDate).format('MM-DD') : '--'}</Text>
                <Text style={styles.engineSignalLabel}>准备放置</Text>
              </View>
            </View>

            <View style={styles.engineChipRow}>
              <Chip compact style={styles.engineChip} textStyle={styles.engineChipText}>
                {hoveredDate ? `准备放到 ${dayjs(hoveredDate).format('MM-DD')}` : DEFAULT_REMINDER_LABEL}
              </Chip>
              <Chip compact style={styles.engineChip} textStyle={styles.engineChipText}>
                允许日期会自动高亮
              </Chip>
            </View>
          </LinearGradient>
        </Card>

        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>{stage.suggestionTitle}</Text>
            <Text style={styles.sectionMeta}>{stage.suggestionSubtitle}</Text>
          </View>
          <View style={styles.sectionTag}>
            <Text style={styles.sectionTagText}>建议清单</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionScrollContent}>
          {stage.calendarSuggestions.map((suggestion) => (
            <DraggableSuggestionCard
              key={suggestion.title}
              suggestion={suggestion}
              actionLabel={
                isDateWithinSuggestionWindow(selectedDate, suggestion)
                  ? `点按加入 ${dayjs(selectedDate).format('MM-DD')}`
                  : `定位到 ${dayjs(resolveSuggestionFocusDate(suggestion, selectedDate)).format('MM-DD')}`
              }
              focusDateLabel={dayjs(resolveSuggestionFocusDate(suggestion, selectedDate)).format('MM-DD')}
              selectedDateAllowed={isDateWithinSuggestionWindow(selectedDate, suggestion)}
              measureDateCells={measureDateCells}
              findDropDate={findDropDate}
              onAddToSelected={handleAddSuggestionToSelected}
              onFocusSuggestionWindow={handleFocusSuggestionWindow}
              onDragStart={setDraggingSuggestion}
              onDragEnd={() => {
                setDraggingSuggestion(null)
                setHoveredDate(null)
              }}
              onHoverDateChange={setHoveredDate}
              onDropOnDate={handleDropSuggestion}
            />
          ))}
        </ScrollView>

        <Card style={styles.calendarCard}>
          <LinearGradient colors={['rgba(255,249,243,1)', 'rgba(255,240,228,1)']} style={styles.calendarCardGradient}>
            <View style={styles.calendarHud}>
              <View style={styles.calendarHudLeft}>
                <Text style={styles.calendarHudEyebrow}>日历视图</Text>
                <Text style={styles.calendarHudTitle}>{dayjs(selectedDate).format('YYYY 年 M 月 D 日')}</Text>
                {!selectedDateIsToday ? (
                  <TouchableOpacity activeOpacity={0.88} onPress={handleReturnToToday} style={styles.calendarHudTodayButton}>
                    <Text style={styles.calendarHudTodayButtonText}>回到今天</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <View style={styles.calendarHudRight}>
                <Text style={styles.calendarHudMetric}>{eventsForSelectedDate.length} 项</Text>
                <Text style={styles.calendarHudMeta}>{draggingSuggestion ? '高亮日期可拖入' : '点击日期查看安排'}</Text>
              </View>
            </View>

            <Calendar
              current={selectedDate}
              onDayPress={onDayPress}
              onMonthChange={onMonthChange}
              hideExtraDays={false}
              markingType="multi-dot"
              markedDates={markedDates}
              dayComponent={renderDayCell}
              theme={{
                calendarBackground: 'transparent',
                textSectionTitleColor: colors.textSecondary,
                monthTextColor: colors.ink,
                todayTextColor: colors.primary,
                arrowColor: colors.ink,
                textDayHeaderFontWeight: '700',
                textMonthFontWeight: '700',
              }}
            />
          </LinearGradient>
        </Card>

        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>{stage.eventHeadline}</Text>
            <Text style={styles.sectionMeta}>已完成 {completedToday} 项，待处理 {pendingToday} 项</Text>
          </View>
          <View style={styles.sectionTag}>
            <Text style={styles.sectionTagText}>当天安排</Text>
          </View>
        </View>

        {eventsForSelectedDate.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <View style={styles.emptyIconShell}>
                <MaterialCommunityIcons name="calendar-blank-outline" size={20} color={colors.techDark} />
              </View>
              <Text style={styles.emptyTitle}>{dayjs(selectedDate).format('YYYY年MM月DD日')} 还没有安排</Text>
              <Text style={styles.emptyText}>{stage.eventEmptyText}</Text>
            </Card.Content>
          </Card>
        ) : (
          eventsForSelectedDate.map((event) => {
            const typeConfig = EVENT_TYPE_CONFIG[event.eventType] ?? EVENT_TYPE_CONFIG.other
            return (
              <Card key={event.id} style={[styles.eventCard, event.isCompleted && styles.eventCardCompleted]}>
                <Card.Content>
                  <View style={styles.eventHeader}>
                    <View style={styles.eventLead}>
                      <View style={[styles.eventIconShell, { backgroundColor: `${typeConfig.color}20` }]}>
                        <MaterialCommunityIcons name={typeConfig.icon} size={16} color={typeConfig.color} />
                      </View>
                      <View style={styles.eventHeaderText}>
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
                    </View>
                  </View>

                  {event.description ? <Text style={styles.eventDescription}>{event.description}</Text> : null}

                  <View style={styles.eventMetaRow}>
                    <Chip compact style={styles.eventMetaChip} textStyle={styles.eventMetaChipText}>
                      {event.reminderEnabled ? DEFAULT_REMINDER_LABEL : '未开启提醒'}
                    </Chip>
                  </View>

                  <View style={styles.eventActions}>
                    <Button
                      compact
                      mode="text"
                      icon={event.isCompleted ? 'check-circle' : 'circle-outline'}
                      onPress={() => void handleComplete(event)}
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
                    {
                      backgroundColor: formType === type ? EVENT_TYPE_CONFIG[type].color : colors.surface,
                      borderColor: formType === type ? EVENT_TYPE_CONFIG[type].color : colors.border,
                    },
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
            <Text style={styles.reminderHint}>{DEFAULT_REMINDER_LABEL}</Text>

            <Button mode="contained" onPress={handleSave} style={styles.saveButton} buttonColor={colors.ink}>
              保存
            </Button>
            <Button mode="text" onPress={() => setModalVisible(false)}>
              取消
            </Button>
          </ScrollView>
        </Modal>
      </Portal>

      <Snackbar visible={!!snackMessage} onDismiss={() => setSnackMessage('')} duration={2400}>
        {snackMessage}
      </Snackbar>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  heroCard: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.xl,
  },
  heroGradient: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    padding: spacing.md,
  },
  heroGlow: {
    position: 'absolute',
    top: -34,
    right: -24,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,248,242,0.5)',
  },
  heroRing: {
    position: 'absolute',
    top: 18,
    right: 24,
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.12)',
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  heroTopText: {
    flex: 1,
  },
  heroChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  heroChip: {
    backgroundColor: 'rgba(255,253,249,0.9)',
  },
  heroChipText: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  heroAssistChip: {
    backgroundColor: 'rgba(220,236,238,0.74)',
  },
  heroAssistChipText: {
    color: colors.techDark,
    fontWeight: '700',
  },
  heroActionButton: {
    borderRadius: borderRadius.pill,
  },
  heroSignalPanel: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,253,249,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.1)',
  },
  heroSignalItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroSignalValue: {
    color: colors.ink,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  heroSignalLabel: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: fontSize.xs,
  },
  heroSignalDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.divider,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    marginTop: spacing.xs,
    color: colors.inkSoft,
    lineHeight: 20,
  },
  statsRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statCard: {
    width: '47%',
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.12)',
    shadowColor: colors.shadowStrong,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  statIconShell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(197,108,71,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statIconShellGreen: {
    backgroundColor: 'rgba(158,171,132,0.14)',
  },
  statIconShellTech: {
    backgroundColor: 'rgba(94,126,134,0.14)',
  },
  statIconShellGold: {
    backgroundColor: 'rgba(184,138,72,0.14)',
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
  stageCard: {
    marginTop: spacing.lg,
    borderRadius: borderRadius.xl,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  stageGradient: {
    borderRadius: borderRadius.xl,
  },
  stageCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  stageCardLead: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  stageIconShell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(94,126,134,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageCardHeaderText: {
    flex: 1,
  },
  stageEyebrow: {
    fontSize: fontSize.xs,
    color: colors.primaryDark,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  stageCardTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  stageCardSubtitle: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  stageChip: {
    backgroundColor: 'rgba(255, 253, 249, 0.82)',
    borderRadius: borderRadius.pill,
  },
  stageChipText: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  stageTagRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  stageTagChip: {
    backgroundColor: 'rgba(255, 253, 249, 0.74)',
    borderRadius: borderRadius.pill,
  },
  stageTagChipText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  engineCard: {
    marginTop: spacing.lg,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.28)',
    backgroundColor: 'transparent',
  },
  engineGradient: {
    padding: spacing.lg,
    position: 'relative',
  },
  engineGlow: {
    position: 'absolute',
    right: -30,
    top: -20,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255, 214, 170, 0.18)',
  },
  engineEyebrow: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#F6D7B1',
  },
  engineTitle: {
    marginTop: spacing.xs,
    fontSize: 21,
    lineHeight: 28,
    fontWeight: '700',
    color: colors.white,
  },
  engineDescription: {
    marginTop: spacing.sm,
    lineHeight: 20,
    color: 'rgba(255,253,249,0.82)',
  },
  engineSignalPanel: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,248,240,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,248,240,0.12)',
  },
  engineSignalItem: {
    flex: 1,
    alignItems: 'center',
  },
  engineSignalValue: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  engineSignalLabel: {
    marginTop: 4,
    color: 'rgba(255,253,249,0.72)',
    fontSize: fontSize.xs,
  },
  engineSignalDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,253,249,0.16)',
  },
  engineChipRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  engineChip: {
    backgroundColor: 'rgba(255, 248, 240, 0.14)',
    borderRadius: borderRadius.pill,
  },
  engineChipText: {
    color: colors.white,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  sectionHeader: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionHeaderRow: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: spacing.md,
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
  sectionTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(220,236,238,0.52)',
  },
  sectionTagText: {
    color: colors.techDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  suggestionScrollContent: {
    gap: spacing.md,
    paddingBottom: spacing.xs,
    paddingRight: spacing.md,
  },
  suggestionCardWrap: {
    width: 244,
  },
  suggestionCardWrapDragging: {
    zIndex: 20,
  },
  suggestionCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: 'rgba(197,108,71,0.16)',
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  suggestionEyebrowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  suggestionLead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  suggestionIconShell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(197,108,71,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionLeadText: {
    flex: 1,
  },
  suggestionEyebrow: {
    fontSize: fontSize.xs,
    color: colors.primaryDark,
    fontWeight: '700',
    letterSpacing: 1,
  },
  suggestionMiniLabel: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: fontSize.xs,
  },
  dragHandle: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.surface,
    gap: 3,
  },
  dragHandleBar: {
    width: 16,
    height: 2,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.primaryDark,
  },
  suggestionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  suggestionDescription: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    lineHeight: 20,
    minHeight: 40,
  },
  suggestionChipRow: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  windowChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.pill,
  },
  windowChipText: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  suggestionRangeText: {
    color: colors.inkSoft,
    fontSize: fontSize.sm,
    flex: 1,
  },
  suggestionInfoBar: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  suggestionHint: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  suggestionActionButton: {
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.ink,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  suggestionActionButtonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(117,69,52,0.18)',
  },
  suggestionAction: {
    color: colors.white,
    fontWeight: '700',
    textAlign: 'center',
  },
  suggestionActionSecondary: {
    color: colors.ink,
  },
  calendarCard: {
    marginTop: spacing.lg,
    borderRadius: borderRadius.xl,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(197,108,71,0.14)',
    overflow: 'hidden',
  },
  calendarCardGradient: {
    padding: spacing.md,
  },
  calendarHud: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255, 248, 240, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.14)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  calendarHudEyebrow: {
    fontSize: fontSize.xs,
    color: colors.primaryDark,
    fontWeight: '700',
    letterSpacing: 1,
  },
  calendarHudTitle: {
    marginTop: spacing.xs,
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  calendarHudLeft: {
    flex: 1,
  },
  calendarHudTodayButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(117,69,52,0.12)',
  },
  calendarHudTodayButtonText: {
    color: colors.ink,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  calendarHudRight: {
    alignItems: 'flex-end',
  },
  calendarHudMetric: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.ink,
  },
  calendarHudMeta: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  dayShell: {
    width: 42,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayTouch: {
    width: 40,
    height: 48,
  },
  dayCell: {
    flex: 1,
    borderRadius: 14,
    paddingTop: 6,
    paddingHorizontal: 5,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,253,249,0.94)',
  },
  dayCellMuted: {
    opacity: 0.54,
  },
  dayCellSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  dayCellAllowed: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(255, 245, 228, 0.98)',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
  },
  dayCellHover: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryDark,
    transform: [{ scale: 1.04 }],
  },
  dayNumber: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
  },
  dayNumberMuted: {
    color: colors.textLight,
  },
  dayNumberSelected: {
    color: colors.white,
  },
  dayNumberAllowed: {
    color: colors.primaryDark,
  },
  dayMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 10,
  },
  todayDot: {
    position: 'absolute',
    top: 8,
    right: 7,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  eventDots: {
    flexDirection: 'row',
    gap: 3,
  },
  eventDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  dropReadyText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: colors.primaryDark,
  },
  emptyCard: {
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.12)',
  },
  emptyContent: {
    alignItems: 'flex-start',
  },
  emptyIconShell: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(94,126,134,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  emptyText: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  eventCard: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.12)',
  },
  eventCardCompleted: {
    opacity: 0.72,
  },
  eventHeader: {
    alignItems: 'flex-start',
  },
  eventLead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  eventIconShell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventHeaderText: {
    flex: 1,
  },
  eventTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  eventTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  eventTitleCompleted: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
  },
  eventDate: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  eventDescription: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  eventMetaRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  eventMetaChip: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.pill,
  },
  eventMetaChipText: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  eventActions: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.xs,
  },
  typeChip: {
    borderRadius: borderRadius.pill,
  },
  typeChipText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  modalContainer: {
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surfaceRaised,
    maxHeight: '84%',
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.12)',
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  input: {
    marginBottom: spacing.md,
    backgroundColor: colors.white,
  },
  fieldLabel: {
    marginBottom: spacing.sm,
    color: colors.text,
    fontWeight: '600',
  },
  typePicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  typeOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  typeOptionText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  typeOptionTextSelected: {
    color: colors.white,
  },
  reminderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  reminderHint: {
    marginBottom: spacing.lg,
    color: colors.textSecondary,
  },
  saveButton: {
    marginBottom: spacing.sm,
    borderRadius: borderRadius.md,
  },
})
