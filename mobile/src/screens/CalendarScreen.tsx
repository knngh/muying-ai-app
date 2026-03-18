import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  Card,
  Chip,
  Button,
  Modal,
  Portal,
  TextInput,
  Switch,
  IconButton,
} from 'react-native-paper';
import { Calendar, DateData } from 'react-native-calendars';
import dayjs from 'dayjs';
import { useCalendarStore } from '../stores/calendarStore';

const THEME_PRIMARY = '#1890ff';

type EventType = 'checkup' | 'vaccine' | 'reminder' | 'other';

const EVENT_TYPE_CONFIG: Record<EventType, { label: string; color: string }> = {
  checkup: { label: '产检', color: '#fa8c16' },
  vaccine: { label: '疫苗', color: '#52c41a' },
  reminder: { label: '提醒', color: '#1890ff' },
  other: { label: '其他', color: '#999999' },
};

const EVENT_TYPES: EventType[] = ['checkup', 'vaccine', 'reminder', 'other'];

interface CalendarEvent {
  id: number;
  title: string;
  description: string;
  eventDate: string;
  eventType: EventType;
  reminderEnabled: boolean;
  isCompleted: boolean;
}

const CalendarScreen: React.FC = () => {
  const {
    events = [],
    createEvent,
    updateEvent,
    deleteEvent,
  } = useCalendarStore();

  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState<EventType>('reminder');
  const [formReminder, setFormReminder] = useState(true);

  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    (events as CalendarEvent[]).forEach((event) => {
      const color = EVENT_TYPE_CONFIG[event.eventType]?.color ?? '#999';
      if (!marks[event.eventDate]) {
        marks[event.eventDate] = { dots: [], marked: true };
      }
      marks[event.eventDate].dots.push({ key: event.id, color });
    });
    if (selectedDate) {
      marks[selectedDate] = {
        ...(marks[selectedDate] || {}),
        selected: true,
        selectedColor: THEME_PRIMARY,
      };
    }
    return marks;
  }, [events, selectedDate]);

  const eventsForSelectedDate = useMemo(
    () => (events as CalendarEvent[]).filter((e) => e.eventDate === selectedDate),
    [events, selectedDate],
  );

  const onDayPress = useCallback((day: DateData) => {
    setSelectedDate(day.dateString);
  }, []);

  const openCreateModal = useCallback(() => {
    setEditingEvent(null);
    setFormTitle('');
    setFormDescription('');
    setFormType('reminder');
    setFormReminder(true);
    setModalVisible(true);
  }, []);

  const openEditModal = useCallback((event: CalendarEvent) => {
    setEditingEvent(event);
    setFormTitle(event.title);
    setFormDescription(event.description);
    setFormType(event.eventType);
    setFormReminder(event.reminderEnabled);
    setModalVisible(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!formTitle.trim()) {
      Alert.alert('提示', '请输入事件标题');
      return;
    }
    if (editingEvent) {
      updateEvent(editingEvent.id, {
        title: formTitle.trim(),
        description: formDescription.trim(),
        eventType: formType,
        reminderEnabled: formReminder,
      });
    } else {
      createEvent({
        title: formTitle.trim(),
        description: formDescription.trim(),
        eventDate: selectedDate,
        eventType: formType,
        reminderEnabled: formReminder,
        isCompleted: false,
      });
    }
    setModalVisible(false);
  }, [
    editingEvent,
    formTitle,
    formDescription,
    formType,
    formReminder,
    selectedDate,
    createEvent,
    updateEvent,
  ]);

  const handleDelete = useCallback(
    (event: CalendarEvent) => {
      Alert.alert('确认删除', `确定要删除"${event.title}"吗？`, [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => deleteEvent(event.id),
        },
      ]);
    },
    [deleteEvent],
  );

  const handleComplete = useCallback(
    (event: CalendarEvent) => {
      updateEvent(event.id, { isCompleted: !event.isCompleted });
    },
    [updateEvent],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>孕育日历</Text>
          <Button
            mode="contained"
            icon="plus"
            onPress={openCreateModal}
            buttonColor={THEME_PRIMARY}
          >
            添加事件
          </Button>
        </View>

        <Calendar
          current={selectedDate}
          onDayPress={onDayPress}
          markingType="multi-dot"
          markedDates={markedDates}
          theme={{
            todayTextColor: THEME_PRIMARY,
            selectedDayBackgroundColor: THEME_PRIMARY,
            arrowColor: THEME_PRIMARY,
          }}
        />

        <View style={styles.eventsSection}>
          <Text style={styles.sectionTitle}>
            {dayjs(selectedDate).format('YYYY年MM月DD日')} 的事件
          </Text>

          {eventsForSelectedDate.length === 0 ? (
            <Text style={styles.emptyText}>暂无事件</Text>
          ) : (
            eventsForSelectedDate.map((event) => {
              const typeConfig = EVENT_TYPE_CONFIG[event.eventType];
              return (
                <Card
                  key={event.id}
                  style={[
                    styles.eventCard,
                    event.isCompleted && styles.eventCardCompleted,
                  ]}
                >
                  <Card.Content>
                    <View style={styles.eventHeader}>
                      <View style={styles.eventTitleRow}>
                        <Text
                          style={[
                            styles.eventTitle,
                            event.isCompleted && styles.eventTitleCompleted,
                          ]}
                        >
                          {event.title}
                        </Text>
                        <Chip
                          compact
                          style={[
                            styles.typeChip,
                            { backgroundColor: typeConfig.color },
                          ]}
                          textStyle={styles.typeChipText}
                        >
                          {typeConfig.label}
                        </Chip>
                      </View>
                      <Text style={styles.eventDate}>
                        {dayjs(event.eventDate).format('YYYY-MM-DD')}
                      </Text>
                    </View>
                    {!!event.description && (
                      <Text style={styles.eventDescription}>
                        {event.description}
                      </Text>
                    )}
                    <View style={styles.eventActions}>
                      <Button
                        compact
                        mode="text"
                        icon={
                          event.isCompleted ? 'check-circle' : 'circle-outline'
                        }
                        onPress={() => handleComplete(event)}
                        textColor={event.isCompleted ? '#52c41a' : '#666'}
                      >
                        {event.isCompleted ? '已完成' : '完成'}
                      </Button>
                      <IconButton
                        icon="pencil"
                        size={18}
                        onPress={() => openEditModal(event)}
                      />
                      <IconButton
                        icon="delete"
                        size={18}
                        iconColor="#ff4d4f"
                        onPress={() => handleDelete(event)}
                      />
                    </View>
                  </Card.Content>
                </Card>
              );
            })
          )}
        </View>
      </ScrollView>

      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <ScrollView>
            <Text style={styles.modalTitle}>
              {editingEvent ? '编辑事件' : '新建事件'}
            </Text>

            <TextInput
              label="标题"
              value={formTitle}
              onChangeText={setFormTitle}
              mode="outlined"
              style={styles.input}
              activeOutlineColor={THEME_PRIMARY}
            />

            <TextInput
              label="描述"
              value={formDescription}
              onChangeText={setFormDescription}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.input}
              activeOutlineColor={THEME_PRIMARY}
            />

            <Text style={styles.fieldLabel}>
              日期: {dayjs(selectedDate).format('YYYY年MM月DD日')}
            </Text>

            <Text style={styles.fieldLabel}>类型</Text>
            <View style={styles.typePicker}>
              {EVENT_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setFormType(t)}
                  style={[
                    styles.typeOption,
                    {
                      backgroundColor:
                        formType === t
                          ? EVENT_TYPE_CONFIG[t].color
                          : '#f0f0f0',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: formType === t ? '#fff' : '#333',
                      fontSize: 14,
                    }}
                  >
                    {EVENT_TYPE_CONFIG[t].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.reminderRow}>
              <Text style={styles.fieldLabel}>开启提醒</Text>
              <Switch
                value={formReminder}
                onValueChange={setFormReminder}
                color={THEME_PRIMARY}
              />
            </View>

            <Button
              mode="contained"
              onPress={handleSave}
              style={styles.saveButton}
              buttonColor={THEME_PRIMARY}
            >
              保存
            </Button>
            <Button mode="text" onPress={() => setModalVisible(false)}>
              取消
            </Button>
          </ScrollView>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  eventsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 20,
    fontSize: 14,
  },
  eventCard: {
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  eventCardCompleted: {
    opacity: 0.6,
  },
  eventHeader: {
    marginBottom: 4,
  },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  eventTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  typeChip: {
    height: 24,
  },
  typeChipText: {
    color: '#fff',
    fontSize: 11,
    lineHeight: 14,
  },
  eventDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  eventDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 6,
  },
  eventActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  modalContainer: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  fieldLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    marginTop: 4,
  },
  typePicker: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  typeOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  reminderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  saveButton: {
    marginBottom: 8,
  },
});

export default CalendarScreen;
