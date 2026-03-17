import { useEffect, useState } from 'react'
import { Card, Calendar as AntCalendar, Typography, List, Tag, Modal, Form, Input, Select, DatePicker, Switch, Button, Space, Spin, Empty } from 'antd'
import { CalendarOutlined, PlusOutlined, CheckCircleOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { useCalendarStore } from '@/stores/calendarStore'
import type { CalendarEvent } from '@/api/modules'
import dayjs, { Dayjs } from 'dayjs'

const { Title, Text, Paragraph } = Typography

const eventTypeColors: Record<string, string> = {
  checkup: 'orange',
  vaccine: 'green',
  reminder: 'blue',
  other: 'default',
}

const eventTypeLabels: Record<string, string> = {
  checkup: '产检',
  vaccine: '疫苗',
  reminder: '提醒',
  other: '其他',
}

export function Calendar() {
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()
  
  const {
    events,
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

  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([])

  useEffect(() => {
    // 初始化时加载当前月份的事件
    const start = dayjs().startOf('month').format('YYYY-MM-DD')
    const end = dayjs().endOf('month').format('YYYY-MM-DD')
    fetchEvents(start, end)
    
    // 获取近期事件
    getUpcomingEvents(7).then(setUpcomingEvents)
  }, [])

  // 处理月份变化
  const handlePanelChange = (date: Dayjs) => {
    const month = date.format('YYYY-MM')
    setCurrentMonth(month)
  }

  // 处理日期选择
  const handleDateSelect = (date: Dayjs) => {
    const dateStr = date.format('YYYY-MM-DD')
    const dayEvents = getEventsByDate(dateStr)
    if (dayEvents.length > 0) {
      selectEvent(dayEvents[0])
    }
  }

  // 打开新建事件弹窗
  const openCreateModal = () => {
    form.resetFields()
    selectEvent(null)
    setModalVisible(true)
  }

  // 打开编辑事件弹窗
  const openEditModal = (event: CalendarEvent) => {
    selectEvent(event)
    form.setFieldsValue({
      title: event.title,
      description: event.description,
      eventDate: dayjs(event.eventDate),
      eventType: event.eventType,
      reminderEnabled: event.reminderEnabled,
    })
    setModalVisible(true)
  }

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const eventData = {
        title: values.title,
        description: values.description,
        eventDate: values.eventDate.format('YYYY-MM-DD'),
        eventType: values.eventType,
        isCompleted: false,
        reminderEnabled: values.reminderEnabled || false,
      }

      if (selectedEvent) {
        await updateEvent(selectedEvent.id, eventData)
      } else {
        await createEvent(eventData)
      }
      
      setModalVisible(false)
      form.resetFields()
    } catch (error) {
      console.error('提交失败:', error)
    }
  }

  // 删除事件
  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个事件吗？',
      onOk: () => deleteEvent(id),
    })
  }

  // 标记完成
  const handleComplete = async (id: number) => {
    await completeEvent(id)
  }

  // 渲染日期单元格
  const dateCellRender = (date: Dayjs) => {
    const dateStr = date.format('YYYY-MM-DD')
    const dayEvents = getEventsByDate(dateStr)
    
    if (dayEvents.length === 0) return null
    
    return (
      <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
        {dayEvents.slice(0, 2).map(event => (
          <li key={event.id}>
            <Tag 
              color={eventTypeColors[event.eventType]}
              style={{ fontSize: 10, padding: '0 4px', marginBottom: 2 }}
            >
              {event.title.length > 6 ? event.title.slice(0, 6) + '...' : event.title}
            </Tag>
          </li>
        ))}
        {dayEvents.length > 2 && (
          <li>
            <Text type="secondary" style={{ fontSize: 10 }}>
              +{dayEvents.length - 2} 更多
            </Text>
          </li>
        )}
      </ul>
    )
  }

  // 渲染事件列表项
  const renderEventItem = (event: CalendarEvent) => (
    <List.Item
      actions={[
        <Button 
          key="complete" 
          type="text" 
          icon={<CheckCircleOutlined />}
          onClick={() => handleComplete(event.id)}
          disabled={event.isCompleted}
        >
          {event.isCompleted ? '已完成' : '完成'}
        </Button>,
        <Button 
          key="edit" 
          type="text" 
          icon={<EditOutlined />}
          onClick={() => openEditModal(event)}
        />,
        <Button 
          key="delete" 
          type="text" 
          danger 
          icon={<DeleteOutlined />}
          onClick={() => handleDelete(event.id)}
        />,
      ]}
    >
      <List.Item.Meta
        title={
          <Space>
            <Text delete={event.isCompleted}>{event.title}</Text>
            <Tag color={eventTypeColors[event.eventType]}>
              {eventTypeLabels[event.eventType]}
            </Tag>
          </Space>
        }
        description={
          <Space direction="vertical" size={0}>
            <Text type="secondary">{event.eventDate}</Text>
            {event.description && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {event.description}
              </Text>
            )}
          </Space>
        }
      />
    </List.Item>
  )

  return (
    <div>
      {/* 头部 */}
      <Card style={{ marginBottom: 24 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>
              <CalendarOutlined /> 孕育日历
            </Title>
            <Text type="secondary">记录重要的孕育里程碑</Text>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            添加事件
          </Button>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        {/* 日历 */}
        <Col xs={24} lg={16}>
          <Card>
            <Spin spinning={loading}>
              <AntCalendar
                mode="month"
                onPanelChange={handlePanelChange}
                onSelect={handleDateSelect}
                cellRender={(current, info) => {
                  if (info.type === 'date') {
                    return (
                      <div>
                        <div>{current.date()}</div>
                        {dateCellRender(current)}
                      </div>
                    )
                  }
                  return info.originNode
                }}
              />
            </Spin>
          </Card>
        </Col>

        {/* 近期事项 */}
        <Col xs={24} lg={8}>
          <Card title="近期事项 (7天内)">
            <Spin spinning={loading}>
              {upcomingEvents.length > 0 ? (
                <List
                  dataSource={upcomingEvents}
                  renderItem={renderEventItem}
                  style={{ maxHeight: 400, overflow: 'auto' }}
                />
              ) : (
                <Empty description="暂无近期事项" />
              )}
            </Spin>
          </Card>
        </Col>
      </Row>

      {/* 新建/编辑事件弹窗 */}
      <Modal
        title={selectedEvent ? '编辑事件' : '新建事件'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={loading}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label="事件标题"
            rules={[{ required: true, message: '请输入事件标题' }]}
          >
            <Input placeholder="例如：产检 - 唐筛" />
          </Form.Item>
          
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="事件详细描述（可选）" />
          </Form.Item>
          
          <Form.Item
            name="eventDate"
            label="日期"
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item
            name="eventType"
            label="事件类型"
            rules={[{ required: true, message: '请选择事件类型' }]}
          >
            <Select placeholder="选择事件类型">
              <Select.Option value="checkup">产检</Select.Option>
              <Select.Option value="vaccine">疫苗</Select.Option>
              <Select.Option value="reminder">提醒</Select.Option>
              <Select.Option value="other">其他</Select.Option>
            </Select>
          </Form.Item>
          
          <Form.Item name="reminderEnabled" label="开启提醒" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}