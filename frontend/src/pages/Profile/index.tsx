import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/appStore'
import { authApi } from '@/api/modules'
import type { User } from '@/api/modules'
import dayjs from 'dayjs'
import styles from './Profile.module.css'

const PREGNANCY_STATUS_OPTIONS = [
  { label: '备孕中', value: 1 },
  { label: '孕期中', value: 2 },
  { label: '产后', value: 3 },
]

const BABY_GENDER_OPTIONS = [
  { label: '男', value: 1 },
  { label: '女', value: 2 },
  { label: '未知', value: 0 },
]

type ProfileDraft = {
  nickname: string
  pregnancyStatus: string
  dueDate: string
  babyBirthday: string
  babyGender: string
}

const initialDraft: ProfileDraft = {
  nickname: '',
  pregnancyStatus: '',
  dueDate: '',
  babyBirthday: '',
  babyGender: '',
}

function normalizePregnancyStatus(value?: number | string) {
  if (value === 1 || value === '1' || value === 'preparing') return 1
  if (value === 2 || value === '2' || value === 'pregnant') return 2
  if (value === 3 || value === '3' || value === 'postpartum') return 3
  return undefined
}

function normalizeBabyGender(value?: number | string) {
  if (value === 1 || value === '1' || value === 'male') return 1
  if (value === 2 || value === '2' || value === 'female') return 2
  if (value === 0 || value === '0' || value === 'unknown') return 0
  return undefined
}

function getBabyGenderLabel(value?: number | string) {
  const normalized = normalizeBabyGender(value)
  if (normalized === 1) return '男'
  if (normalized === 2) return '女'
  if (normalized === 0) return '未知'
  return '-'
}

function formatPhone(phone: string) {
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

export function Profile() {
  const navigate = useNavigate()
  const { user, setUser } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [draft, setDraft] = useState<ProfileDraft>(initialDraft)
  const [toast, setToast] = useState('')

  const fetchProfile = useCallback(async () => {
    setLoading(true)
    try {
      const userData = (await authApi.me()) as User
      setUser(userData)
    } catch {
      if (import.meta.env.DEV) {
        if (!user) {
          setUser({
            id: '1',
            username: 'mock_user',
            nickname: '测试用户',
            createdAt: new Date().toISOString(),
          })
        }
      } else {
        setToast('获取用户信息失败')
      }
    } finally {
      setLoading(false)
    }
  }, [setUser, user])

  useEffect(() => {
    void fetchProfile()
  }, [fetchProfile])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 1800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const handleEdit = () => {
    setDraft({
      nickname: user?.nickname || '',
      pregnancyStatus: normalizePregnancyStatus(user?.pregnancyStatus)?.toString() || '',
      dueDate: user?.dueDate ? dayjs(user.dueDate).format('YYYY-MM-DD') : '',
      babyBirthday: user?.babyBirthday ? dayjs(user.babyBirthday).format('YYYY-MM-DD') : '',
      babyGender: normalizeBabyGender(user?.babyGender)?.toString() || '',
    })
    setEditModalOpen(true)
  }

  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setEditLoading(true)
    try {
      const data = {
        nickname: draft.nickname || undefined,
        pregnancyStatus: draft.pregnancyStatus ? Number(draft.pregnancyStatus) : undefined,
        dueDate: draft.dueDate || undefined,
        babyBirthday: draft.babyBirthday || undefined,
        babyGender: draft.babyGender ? Number(draft.babyGender) : undefined,
      }
      const updatedUser = (await authApi.updateProfile(data)) as User
      setUser(updatedUser)
      setToast('资料更新成功')
      setEditModalOpen(false)
    } catch {
      if (import.meta.env.DEV && user) {
        setUser({
          ...user,
          nickname: draft.nickname || user.nickname,
          pregnancyStatus: draft.pregnancyStatus ? Number(draft.pregnancyStatus) : undefined,
          dueDate: draft.dueDate || undefined,
          babyBirthday: draft.babyBirthday || undefined,
          babyGender: draft.babyGender ? Number(draft.babyGender) : undefined,
        })
        setToast('API 不可用，本地更新')
        setEditModalOpen(false)
      } else {
        setToast('更新失败')
      }
    } finally {
      setEditLoading(false)
    }
  }

  const handleLogout = async () => {
    if (!window.confirm('确定要退出登录吗？')) return

    try {
      await authApi.logout()
    } catch {
      // 忽略登出接口错误，本地状态仍需清理。
    }
    localStorage.removeItem('token')
    setUser(null)
    navigate('/login')
  }

  if (loading && !user) {
    return (
      <div className={styles.loadingState}>
        <span className={styles.loadingDot} />
        <span>正在加载资料...</span>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {toast ? <div className={styles.toast}>{toast}</div> : null}

      <section className={styles.profileCard}>
        <div className={styles.avatar}>{(user?.nickname || user?.username || '用').slice(0, 1).toUpperCase()}</div>
        <h1>{user?.nickname || user?.username || '用户'}</h1>
        <p>{user?.username || '未登录用户'}</p>
      </section>

      <section className={styles.infoCard}>
        <div className={styles.infoRow}>
          <span>用户名</span>
          <strong>{user?.username || '-'}</strong>
        </div>
        {user?.phone ? (
          <div className={styles.infoRow}>
            <span>手机号</span>
            <strong>{formatPhone(user.phone)}</strong>
          </div>
        ) : null}
        {user?.email ? (
          <div className={styles.infoRow}>
            <span>邮箱</span>
            <strong>{user.email}</strong>
          </div>
        ) : null}
        {user?.dueDate ? (
          <div className={styles.infoRow}>
            <span>预产期</span>
            <strong>{dayjs(user.dueDate).format('YYYY年MM月DD日')}</strong>
          </div>
        ) : null}
        {user?.babyBirthday ? (
          <div className={styles.infoRow}>
            <span>宝宝生日</span>
            <strong>{dayjs(user.babyBirthday).format('YYYY年MM月DD日')}</strong>
          </div>
        ) : null}
        {user?.babyGender !== undefined && user?.babyGender !== null ? (
          <div className={styles.infoRow}>
            <span>宝宝性别</span>
            <strong>{getBabyGenderLabel(user.babyGender)}</strong>
          </div>
        ) : null}
        <div className={styles.infoRow}>
          <span>注册时间</span>
          <strong>{user?.createdAt ? dayjs(user.createdAt).format('YYYY-MM-DD') : '-'}</strong>
        </div>
      </section>

      <section className={styles.actionCard}>
        <button type="button" className={styles.primaryButton} onClick={handleEdit}>
          编辑资料
        </button>
        <button type="button" className={styles.dangerButton} onClick={handleLogout}>
          退出登录
        </button>
      </section>

      {editModalOpen ? (
        <div className={styles.modalOverlay} onClick={() => setEditModalOpen(false)}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.eyebrow}>Profile</span>
                <h2>编辑资料</h2>
              </div>
              <button type="button" className={styles.textButton} onClick={() => setEditModalOpen(false)}>
                关闭
              </button>
            </div>

            <form className={styles.form} onSubmit={handleEditSubmit}>
              <label className={styles.formField}>
                <span>昵称</span>
                <input
                  value={draft.nickname}
                  onChange={(event) => setDraft((current) => ({ ...current, nickname: event.target.value }))}
                  placeholder="请输入昵称"
                />
              </label>

              <label className={styles.formField}>
                <span>状态</span>
                <select
                  value={draft.pregnancyStatus}
                  onChange={(event) => setDraft((current) => ({ ...current, pregnancyStatus: event.target.value }))}
                >
                  <option value="">请选择</option>
                  {PREGNANCY_STATUS_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>

              <label className={styles.formField}>
                <span>预产期</span>
                <input
                  type="date"
                  value={draft.dueDate}
                  onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))}
                />
              </label>

              <label className={styles.formField}>
                <span>宝宝生日</span>
                <input
                  type="date"
                  value={draft.babyBirthday}
                  onChange={(event) => setDraft((current) => ({ ...current, babyBirthday: event.target.value }))}
                />
              </label>

              <label className={styles.formField}>
                <span>宝宝性别</span>
                <select
                  value={draft.babyGender}
                  onChange={(event) => setDraft((current) => ({ ...current, babyGender: event.target.value }))}
                >
                  <option value="">请选择</option>
                  {BABY_GENDER_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>

              <button type="submit" className={styles.primaryButton} disabled={editLoading}>
                {editLoading ? '保存中...' : '保存'}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
