import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useCalendarStore } from '@/stores/calendarStore'
import type { CalendarEvent } from '@/api/modules'
import dayjs, { Dayjs } from 'dayjs'
import styles from './Calendar.module.css'

type EventDraft = {
  title: string
  description: string
  eventDate: string
  eventType: CalendarEvent['eventType']
  reminderEnabled: boolean
}

const initialDraft: EventDraft = {
  title: '',
  description: '',
  eventDate: dayjs().format('YYYY-MM-DD'),
  eventType: 'checkup',
  reminderEnabled: false,
}

const eventTypeLabels: Record<CalendarEvent['eventType'], string> = {
  checkup: '产检',
  vaccine: '疫苗',
  reminder: '提醒',
  exercise: '运动',
  diet: '饮食',
  other: '其他',
}

function buildMonthGrid(month: string) {
  const startOfMonth = dayjs(month).startOf('month')
  const firstCell = startOfMonth.startOf('week')
  return Array.from({ length: 42 }, (_, index) => firstCell.add(index, 'day'))
}

export function Calendar() {
  const [modalVisible, setModalVisible] = useState(false)
  const [draft, setDraft] = useState<EventDraft>(initialDraft)
  const [formError, setFormError] = useState('')
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([])

  const {
    selectedEvent,
    currentMonth,
    loading,
    fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    completeEvent,
    selectEvent,
    setCurrentMonth,
    getEventsByDate,
    getUpcomingEvents,
  } = useCalendarStore()

  const monthDays = useMemo(() => buildMonthGrid(currentMonth), [currentMonth])
  const monthLabel = dayjs(currentMonth).format('YYYY年MM月')

  const refreshUpcoming = useCallback(() => {
    getUpcomingEvents(7).then(setUpcomingEvents)
  }, [getUpcomingEvents])

  useEffect(() => {
    const start = dayjs(currentMonth).startOf('month').format('YYYY-MM-DD')
    const end = dayjs(currentMonth).endOf('month').format('YYYY-MM-DD')
    fetchEvents(start, end)
    refreshUpcoming()
  }, [currentMonth, fetchEvents, refreshUpcoming])

  const changeMonth = (offset: number) => {
    setCurrentMonth(dayjs(currentMonth).add(offset, 'month').format('YYYY-MM'))
  }

  const openCreateModal = (date?: Dayjs) => {
    selectEvent(null)
    setDraft({
      ...initialDraft,
      eventDate: date?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'),
    })
    setFormError('')
    setModalVisible(true)
  }

  const openEditModal = (event: CalendarEvent) => {
    selectEvent(event)
    setDraft({
      title: event.title,
      description: event.description || '',
      eventDate: event.eventDate,
      eventType: event.eventType,
      reminderEnabled: event.reminderEnabled,
    })
    setFormError('')
    setModalVisible(true)
  }

  const handleCloseModal = () => {
    setModalVisible(false)
    selectEvent(null)
    setDraft(initialDraft)
    setFormError('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!draft.title.trim()) {
      setFormError('请输入事件标题')
      return
    }
    if (!draft.eventDate) {
      setFormError('请选择日期')
      return
    }

    const eventData = {
      title: draft.title.trim(),
      description: draft.description.trim() || undefined,
      eventDate: draft.eventDate,
      eventType: draft.eventType,
      isCompleted: selectedEvent?.isCompleted || false,
      reminderEnabled: draft.reminderEnabled,
    }

    if (selectedEvent) {
      await updateEvent(selectedEvent.id, eventData)
    } else {
      await createEvent(eventData)
    }

    handleCloseModal()
    refreshUpcoming()
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('确定要删除这个事件吗？')) return
    await deleteEvent(id)
    refreshUpcoming()
  }

  const handleComplete = async (id: number) => {
    await completeEvent(id)
    refreshUpcoming()
  }

  const renderEventPills = (events: CalendarEvent[]) => (
    <div className={styles.dayEvents}>
      {events.slice(0, 2).map((event) => (
        <span key={event.id} className={`${styles.eventPill} ${styles[`eventType_${event.eventType}`] || ''}`}>
          {event.title.length > 7 ? `${event.title.slice(0, 7)}...` : event.title}
        </span>
      ))}
      {events.length > 2 ? <span className={styles.morePill}>+{events.length - 2}</span> : null}
    </div>
  )

  const renderEventItem = (event: CalendarEvent) => (
    <article key={event.id} className={styles.eventItem}>
      <div>
        <div className={styles.eventTitleRow}>
          <strong className={event.isCompleted ? styles.completedTitle : ''}>{event.title}</strong>
          <span className={`${styles.typeBadge} ${styles[`eventType_${event.eventType}`] || ''}`}>
            {eventTypeLabels[event.eventType] || event.eventType}
          </span>
        </div>
        <p>{event.eventDate}</p>
        {event.description ? <p>{event.description}</p> : null}
      </div>
      <div className={styles.eventActions}>
        <button
          type="button"
          className={styles.textButton}
          disabled={event.isCompleted}
          onClick={() => handleComplete(event.id)}
        >
          {event.isCompleted ? '已完成' : '完成'}
        </button>
        <button type="button" className={styles.textButton} onClick={() => openEditModal(event)}>
          编辑
        </button>
        <button type="button" className={styles.textButtonDanger} onClick={() => handleDelete(event.id)}>
          删除
        </button>
      </div>
    </article>
  )

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Care Calendar</span>
          <h1>孕育日历</h1>
          <p>记录产检、疫苗、提醒和日常安排，把关键节点放到同一个月视图里。</p>
        </div>
        <button type="button" className={styles.primaryButton} onClick={() => openCreateModal()}>
          添加事件
        </button>
      </section>

      <div className={styles.contentGrid}>
        <section className={styles.calendarCard}>
          <div className={styles.monthHeader}>
            <button type="button" className={styles.secondaryButton} onClick={() => changeMonth(-1)}>
              上个月
            </button>
            <h2>{monthLabel}</h2>
            <button type="button" className={styles.secondaryButton} onClick={() => changeMonth(1)}>
              下个月
            </button>
          </div>

          {loading ? <div className={styles.loadingBar}>正在同步事件...</div> : null}

          <div className={styles.weekHeader}>
            {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className={styles.monthGrid}>
            {monthDays.map((date) => {
              const dateStr = date.format('YYYY-MM-DD')
              const dayEvents = getEventsByDate(dateStr)
              const inMonth = date.format('YYYY-MM') === currentMonth
              const isToday = date.isSame(dayjs(), 'day')

              return (
                <button
                  key={dateStr}
                  type="button"
                  className={[
                    styles.dayCell,
                    inMonth ? '' : styles.dayCellMuted,
                    isToday ? styles.dayCellToday : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => {
                    if (dayEvents[0]) {
                      selectEvent(dayEvents[0])
                    } else {
                      openCreateModal(date)
                    }
                  }}
                >
                  <span className={styles.dayNumber}>{date.date()}</span>
                  {renderEventPills(dayEvents)}
                </button>
              )
            })}
          </div>
        </section>

        <aside className={styles.sidePanel}>
          <section className={styles.panelCard}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.eyebrow}>Upcoming</span>
                <h2>近期事项</h2>
              </div>
            </div>
            {upcomingEvents.length > 0 ? (
              <div className={styles.eventList}>
                {upcomingEvents.map(renderEventItem)}
              </div>
            ) : (
              <div className={styles.emptyState}>暂无近期事项</div>
            )}
          </section>

          <section className={styles.panelCard}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.eyebrow}>Selected</span>
                <h2>选中事件</h2>
              </div>
            </div>
            {selectedEvent ? (
              renderEventItem(selectedEvent)
            ) : (
              <div className={styles.emptyState}>点击日期或事件查看详情</div>
            )}
          </section>
        </aside>
      </div>

      {modalVisible ? (
        <div className={styles.modalOverlay} onClick={handleCloseModal}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.eyebrow}>Event</span>
                <h2>{selectedEvent ? '编辑事件' : '新建事件'}</h2>
              </div>
              <button type="button" className={styles.textButton} onClick={handleCloseModal}>
                关闭
              </button>
            </div>

            <form className={styles.form} onSubmit={handleSubmit}>
              <label className={styles.formField}>
                <span>事件标题</span>
                <input
                  value={draft.title}
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                  placeholder="例如：产检 - 唐筛"
                />
              </label>

              <label className={styles.formField}>
                <span>描述</span>
                <textarea
                  rows={3}
                  value={draft.description}
                  onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                  placeholder="事件详细描述（可选）"
                />
              </label>

              <label className={styles.formField}>
                <span>日期</span>
                <input
                  type="date"
                  value={draft.eventDate}
                  onChange={(event) => setDraft((current) => ({ ...current, eventDate: event.target.value }))}
                />
              </label>

              <label className={styles.formField}>
                <span>事件类型</span>
                <select
                  value={draft.eventType}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    eventType: event.target.value as CalendarEvent['eventType'],
                  }))}
                >
                  {Object.entries(eventTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>

              <label className={styles.switchRow}>
                <input
                  type="checkbox"
                  checked={draft.reminderEnabled}
                  onChange={(event) => setDraft((current) => ({ ...current, reminderEnabled: event.target.checked }))}
                />
                <span>开启提醒</span>
              </label>

              {formError ? <div className={styles.formError}>{formError}</div> : null}

              <button type="submit" className={styles.primaryButton} disabled={loading}>
                {loading ? '保存中...' : '保存'}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
