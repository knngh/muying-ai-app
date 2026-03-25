import { Form, DatePicker, Select, Button, message } from 'antd'
import dayjs from 'dayjs'
import type { User } from '@/api/modules'
import { authApi } from '@/api/modules'
import { useAppStore } from '@/stores/appStore'
import { calculatePregnancyStartFromDueDate } from '@/utils'
import { useState } from 'react'

interface BirthDateFormProps {
  user: User | null
  onComplete: (pregnancyStartDate: string, birthDate: string, babyGender?: string) => void
}

export function BirthDateForm({ user, onComplete }: BirthDateFormProps) {
  const { setUser } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  const initialValues = {
    pregnancyStartDate: user?.dueDate
      ? dayjs(calculatePregnancyStartFromDueDate(user.dueDate))
      : undefined,
    birthDate: user?.babyBirthday ? dayjs(user.babyBirthday) : undefined,
    babyGender: user?.babyGender || undefined,
  }

  const handleSubmit = async (values: {
    pregnancyStartDate: dayjs.Dayjs
    birthDate: dayjs.Dayjs
    babyGender?: string
  }) => {
    const startStr = values.pregnancyStartDate.format('YYYY-MM-DD')
    const birthStr = values.birthDate.format('YYYY-MM-DD')

    if (values.birthDate.isBefore(values.pregnancyStartDate)) {
      message.error('出生日期不能早于怀孕日期')
      return
    }

    setLoading(true)
    try {
      const profileData: {
        babyBirthday: string
        dueDate: string
        babyGender?: string
      } = {
        babyBirthday: birthStr,
        dueDate: dayjs(startStr).add(280, 'day').format('YYYY-MM-DD'),
      }
      if (values.babyGender) {
        profileData.babyGender = values.babyGender
      }
      const updatedUser = (await authApi.updateProfile(profileData)) as User
      setUser(updatedUser)
    } catch (_error) {
      if (import.meta.env.DEV) {
        setUser({
          ...user!,
          babyBirthday: birthStr,
          dueDate: dayjs(startStr).add(280, 'day').format('YYYY-MM-DD'),
          babyGender: values.babyGender || user?.babyGender,
        })
        message.warning('API 不可用，本地更新')
      } else {
        message.error('保存失败，请重试')
        setLoading(false)
        return
      }
    }
    setLoading(false)
    onComplete(startStr, birthStr, values.babyGender)
  }

  return (
    <div style={{ padding: '16px 0' }}>
      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues}
        onFinish={handleSubmit}
      >
        <Form.Item
          name="pregnancyStartDate"
          label="怀孕日期（末次月经）"
          rules={[{ required: true, message: '请选择怀孕日期' }]}
        >
          <DatePicker style={{ width: '100%' }} placeholder="选择末次月经日期" />
        </Form.Item>

        <Form.Item
          name="birthDate"
          label="宝宝出生日期"
          rules={[{ required: true, message: '请选择出生日期' }]}
        >
          <DatePicker style={{ width: '100%' }} placeholder="选择宝宝出生日期" />
        </Form.Item>

        <Form.Item name="babyGender" label="宝宝性别（可选）">
          <Select
            placeholder="请选择"
            allowClear
            options={[
              { label: '男宝宝', value: 'male' },
              { label: '女宝宝', value: 'female' },
              { label: '暂不透露', value: 'unknown' },
            ]}
          />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            生成出生卡片
          </Button>
        </Form.Item>
      </Form>
    </div>
  )
}
