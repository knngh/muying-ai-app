import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Card,
  Descriptions,
  Empty,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { authApi } from '@/api/modules'
import { communityApi, type CommunityReportItem } from '@/api/community'
import { useAppStore } from '@/stores/appStore'

const { Paragraph, Text, Title } = Typography

const reasonLabelMap: Record<string, string> = {
  spam: '广告引流',
  abuse: '辱骂攻击',
  misinformation: '错误信息',
  privacy: '隐私泄露',
  illegal: '违法违规',
  other: '其他问题',
}

const statusColorMap: Record<string, string> = {
  pending: 'gold',
  reviewed: 'green',
  rejected: 'default',
}

const statusLabelMap: Record<string, string> = {
  pending: '待处理',
  reviewed: '已处理',
  rejected: '已驳回',
}

const actionLabelMap: Record<string, string> = {
  none: '无动作',
  hide_post: '隐藏帖子',
  delete_comment: '删除评论',
}

export function CommunityReports() {
  const navigate = useNavigate()
  const user = useAppStore((state) => state.user)
  const setUser = useAppStore((state) => state.setUser)
  const [loading, setLoading] = useState(true)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [reports, setReports] = useState<CommunityReportItem[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<'pending' | 'reviewed' | 'rejected' | undefined>('pending')
  const [targetTypeFilter, setTargetTypeFilter] = useState<'post' | 'comment' | undefined>()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    void ensureAdmin()
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    void fetchReports()
  }, [isAdmin, page, pageSize, statusFilter, targetTypeFilter])

  const ensureAdmin = async () => {
    try {
      const currentUser = user || await authApi.me()
      if (!user) {
        setUser(currentUser)
      }

      if (currentUser.username !== 'admin') {
        message.error('仅管理员可访问举报处理页')
        navigate('/community', { replace: true })
        return
      }

      setIsAdmin(true)
    } catch (_error) {
      message.error('请先登录管理员账号')
      navigate('/login', { replace: true })
    }
  }

  const fetchReports = async () => {
    setLoading(true)
    try {
      const result = await communityApi.getReports({
        page,
        pageSize,
        status: statusFilter,
        targetType: targetTypeFilter,
      })
      setReports(result.list || [])
      setTotal(result.pagination?.total || 0)
    } catch (_error) {
      message.error('获取举报列表失败')
    } finally {
      setLoading(false)
    }
  }

  const refreshCurrentPage = async () => {
    await fetchReports()
  }

  const handleProcess = (report: CommunityReportItem, nextStatus: 'reviewed' | 'rejected', actionTaken?: 'none' | 'hide_post' | 'delete_comment') => {
    const isApprove = nextStatus === 'reviewed'
    const title = isApprove ? '确认处理举报' : '确认驳回举报'
    const content = isApprove
      ? `将把该举报标记为已处理，并执行「${actionLabelMap[actionTaken || 'none']}」。`
      : '将把该举报标记为已驳回。'

    Modal.confirm({
      title,
      content,
      okText: isApprove ? '确认处理' : '确认驳回',
      cancelText: '取消',
      okButtonProps: isApprove ? undefined : { danger: true },
      onOk: async () => {
        try {
          setSubmittingId(report.id)
          await communityApi.handleReport(report.id, {
            status: nextStatus,
            actionTaken,
            decisionReason: isApprove
              ? `管理员确认执行：${actionLabelMap[actionTaken || 'none']}`
              : '管理员判定举报不成立',
          })
          message.success(isApprove ? '举报已处理' : '举报已驳回')
          await refreshCurrentPage()
        } catch (_error) {
          message.error(isApprove ? '处理失败' : '驳回失败')
        } finally {
          setSubmittingId(null)
        }
      },
    })
  }

  const columns: ColumnsType<CommunityReportItem> = [
    {
      title: '举报信息',
      key: 'report',
      width: 300,
      render: (_, record) => (
        <Space direction="vertical" size={4}>
          <Space wrap>
            <Tag color={statusColorMap[record.status]}>{statusLabelMap[record.status] || record.status}</Tag>
            <Tag>{record.targetType === 'post' ? '帖子' : '评论'}</Tag>
            <Tag color={record.handledByAI ? 'blue' : 'default'}>
              {record.handledByAI ? 'AI已处理' : '人工/待处理'}
            </Tag>
          </Space>
          <Text strong>{reasonLabelMap[record.reason] || record.reason}</Text>
          <Text type="secondary">
            举报人：{record.reporter?.nickname || record.reporter?.username || '-'}
          </Text>
          <Text type="secondary">
            提交时间：{dayjs(record.createdAt).format('YYYY-MM-DD HH:mm')}
          </Text>
        </Space>
      ),
    },
    {
      title: '被举报内容',
      key: 'target',
      render: (_, record) => {
        const targetTitle = record.targetType === 'post'
          ? (record.post?.title || '帖子已不可见')
          : `评论 #${record.comment?.id || '-'}`
        const targetContent = record.targetType === 'post'
          ? record.post?.content
          : record.comment?.content
        const targetAuthor = record.targetType === 'post'
          ? (record.post?.author?.nickname || record.post?.author?.username)
          : (record.comment?.author?.nickname || record.comment?.author?.username)

        return (
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Text strong>{targetTitle}</Text>
            <Text type="secondary">作者：{targetAuthor || '-'}</Text>
            <Paragraph ellipsis={{ rows: 3, expandable: true, symbol: '展开' }} style={{ marginBottom: 0 }}>
              {targetContent || '内容已被处理或不存在'}
            </Paragraph>
            {record.description && (
              <Text type="secondary">举报补充：{record.description}</Text>
            )}
          </Space>
        )
      },
    },
    {
      title: '处理结果',
      key: 'decision',
      width: 240,
      render: (_, record) => (
        <Space direction="vertical" size={4}>
          <Text>动作：{actionLabelMap[record.actionTaken] || record.actionTaken}</Text>
          <Paragraph ellipsis={{ rows: 3, expandable: true, symbol: '展开' }} style={{ marginBottom: 0 }}>
            {record.decisionReason || '暂无处理说明'}
          </Paragraph>
          <Text type="secondary">
            处理时间：{record.handledAt ? dayjs(record.handledAt).format('YYYY-MM-DD HH:mm') : '未处理'}
          </Text>
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 240,
      render: (_, record) => {
        if (record.status !== 'pending') {
          return <Text type="secondary">已完成</Text>
        }

        const defaultAction = record.targetType === 'post' ? 'hide_post' : 'delete_comment'

        return (
          <Space direction="vertical" size={8}>
            <Button
              type="primary"
              size="small"
              loading={submittingId === record.id}
              onClick={() => handleProcess(record, 'reviewed', defaultAction)}
            >
              {record.targetType === 'post' ? '通过并隐藏帖子' : '通过并删除评论'}
            </Button>
            <Button
              size="small"
              loading={submittingId === record.id}
              onClick={() => handleProcess(record, 'reviewed', 'none')}
            >
              仅标记已处理
            </Button>
            <Button
              danger
              size="small"
              loading={submittingId === record.id}
              onClick={() => handleProcess(record, 'rejected', 'none')}
            >
              驳回举报
            </Button>
          </Space>
        )
      },
    },
  ]

  if (loading && !isAdmin) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Title level={3} style={{ margin: 0 }}>社区举报处理</Title>
          <Text type="secondary">
            举报提交后会先经过 AI 自动判断；你可以在这里查看处理结果，并对待处理项做人工覆写。
          </Text>
          <Descriptions size="small" column={3} bordered>
            <Descriptions.Item label="当前页数量">{reports.length}</Descriptions.Item>
            <Descriptions.Item label="总举报数">{total}</Descriptions.Item>
            <Descriptions.Item label="默认管理员">admin</Descriptions.Item>
          </Descriptions>
          <Space wrap>
            <Select
              allowClear
              style={{ width: 180 }}
              placeholder="筛选状态"
              value={statusFilter}
              onChange={(value) => {
                setPage(1)
                setStatusFilter(value)
              }}
              options={[
                { label: '待处理', value: 'pending' },
                { label: '已处理', value: 'reviewed' },
                { label: '已驳回', value: 'rejected' },
              ]}
            />
            <Select
              allowClear
              style={{ width: 180 }}
              placeholder="筛选目标类型"
              value={targetTypeFilter}
              onChange={(value) => {
                setPage(1)
                setTargetTypeFilter(value)
              }}
              options={[
                { label: '帖子', value: 'post' },
                { label: '评论', value: 'comment' },
              ]}
            />
            <Button onClick={() => void refreshCurrentPage()}>刷新列表</Button>
          </Space>
        </Space>
      </Card>

      <Card bodyStyle={{ padding: 0 }}>
        {reports.length === 0 && !loading ? (
          <Empty style={{ padding: 48 }} description="暂无举报记录" />
        ) : (
          <Table
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={reports}
            pagination={{
              current: page,
              pageSize,
              total,
              onChange: (nextPage, nextPageSize) => {
                setPage(nextPage)
                setPageSize(nextPageSize)
              },
            }}
            scroll={{ x: 1100 }}
          />
        )}
      </Card>
    </Space>
  )
}
