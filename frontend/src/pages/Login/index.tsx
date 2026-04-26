import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/appStore'
import { authApi } from '@/api/modules'
import styles from './Login.module.css'

type AuthMode = 'login' | 'register'

type FormData = {
  username: string
  password: string
  phone: string
  email: string
}

type FormErrors = Partial<Record<keyof FormData, string>>

const initialForm: FormData = {
  username: '',
  password: '',
  phone: '',
  email: '',
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function Login() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<FormData>(initialForm)
  const [errors, setErrors] = useState<FormErrors>({})
  const [feedback, setFeedback] = useState<{ type: 'error' | 'warning'; message: string } | null>(null)
  const navigate = useNavigate()
  const setUser = useAppStore((s) => s.setUser)

  const validate = () => {
    const nextErrors: FormErrors = {}

    if (!formData.username.trim()) {
      nextErrors.username = '请输入用户名'
    } else if (formData.username.trim().length < 2) {
      nextErrors.username = '用户名至少2个字符'
    }

    if (!formData.password) {
      nextErrors.password = '请输入密码'
    } else if (mode === 'register' && formData.password.length < 8) {
      nextErrors.password = '密码至少8位'
    }

    if (mode === 'register' && formData.email.trim() && !isValidEmail(formData.email.trim())) {
      nextErrors.email = '请输入正确的邮箱'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setFeedback(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validate()) {
      return
    }

    setLoading(true)
    setFeedback(null)

    try {
      const result =
        mode === 'login'
          ? await authApi.login({ username: formData.username.trim(), password: formData.password })
          : await authApi.register({
              username: formData.username.trim(),
              password: formData.password,
              phone: formData.phone.trim() || undefined,
              email: formData.email.trim() || undefined,
            })

      localStorage.setItem('token', result.token)
      setUser(result.user)
      navigate('/')
    } catch {
      if (import.meta.env.DEV) {
        const mockUser = {
          id: '1',
          username: formData.username.trim(),
          nickname: formData.username.trim(),
          createdAt: new Date().toISOString(),
        }
        localStorage.setItem('token', 'mock_token_' + Date.now())
        setUser(mockUser)
        setFeedback({ type: 'warning', message: 'API 不可用，已切换开发模式登录。' })
        navigate('/')
      } else {
        setFeedback({
          type: 'error',
          message: mode === 'login' ? '登录失败，请检查用户名和密码。' : '注册失败，请稍后重试。',
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    setMode((current) => (current === 'login' ? 'register' : 'login'))
    setFormData(initialForm)
    setErrors({})
    setFeedback(null)
  }

  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        <div className={styles.intro}>
          <span className={styles.eyebrow}>Mother & Baby Intelligence</span>
          <h1>母婴AI助手</h1>
          <p>
            {mode === 'login'
              ? '登录后继续查看知识、日历和个人资料。'
              : '创建账户后，把你的孕育记录和偏好保存在同一个入口里。'}
          </p>
          <div className={styles.metrics}>
            <div>
              <span>01</span>
              <strong>知识阅读</strong>
            </div>
            <div>
              <span>02</span>
              <strong>阶段问答</strong>
            </div>
            <div>
              <span>03</span>
              <strong>日历记录</strong>
            </div>
          </div>
        </div>

        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h2>{mode === 'login' ? '欢迎回来' : '创建账户'}</h2>
            <p>{mode === 'login' ? '输入账号信息继续使用。' : '先完成基础信息，后续可以再补充资料。'}</p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <label className={styles.field}>
              <span>用户名</span>
              <input
                value={formData.username}
                onChange={(event) => handleChange('username', event.target.value)}
                placeholder="用户名 / 手机号 / 邮箱"
                autoComplete="username"
              />
              {errors.username ? <small>{errors.username}</small> : null}
            </label>

            <label className={styles.field}>
              <span>密码</span>
              <input
                type="password"
                value={formData.password}
                onChange={(event) => handleChange('password', event.target.value)}
                placeholder={mode === 'login' ? '输入密码' : '至少 8 位'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              {errors.password ? <small>{errors.password}</small> : null}
            </label>

            {mode === 'register' ? (
              <>
                <label className={styles.field}>
                  <span>手机号</span>
                  <input
                    value={formData.phone}
                    onChange={(event) => handleChange('phone', event.target.value)}
                    placeholder="手机号（选填）"
                    inputMode="numeric"
                    maxLength={11}
                    autoComplete="tel"
                  />
                </label>

                <label className={styles.field}>
                  <span>邮箱</span>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(event) => handleChange('email', event.target.value)}
                    placeholder="邮箱（选填）"
                    autoComplete="email"
                  />
                  {errors.email ? <small>{errors.email}</small> : null}
                </label>
              </>
            ) : null}

            {feedback ? (
              <div className={feedback.type === 'warning' ? styles.feedbackWarning : styles.feedbackError}>
                {feedback.message}
              </div>
            ) : null}

            <button type="submit" className={styles.submitButton} disabled={loading}>
              {loading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
            </button>
          </form>

          <div className={styles.switchRow}>
            <span>{mode === 'login' ? '还没有账号？' : '已有账号？'}</span>
            <button type="button" className={styles.switchButton} onClick={toggleMode}>
              {mode === 'login' ? '立即注册' : '立即登录'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
