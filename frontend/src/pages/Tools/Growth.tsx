import { useEffect, useMemo, useState, type FormEvent } from 'react'
import dayjs from 'dayjs'
import { useGrowthStore } from '@/stores/growthStore'
import { GrowthChart } from '@/components/GrowthChart'
import type { GrowthChartPoint } from '@/components/GrowthChart'
import { percentileFromZ, zScore } from '@/data/who-growth-standards'
import type { ChartSex, GrowthMetric } from '@/data/who-growth-standards'
import type { BabyMeasurement } from '@/api/tools'
import { v4 } from '@/utils/uuid'
import { dateOnly } from '@/utils/dateOnly'
import { usePageTitle } from '@/hooks'
import styles from './Growth.module.css'

const METRIC_LABELS: Record<GrowthMetric, string> = {
  height: '身高',
  weight: '体重',
  head: '头围',
}

const METRIC_UNITS: Record<GrowthMetric, string> = {
  height: 'cm',
  weight: 'kg',
  head: 'cm',
}

const METRIC_RANGES: Record<GrowthMetric, [number, number]> = {
  height: [30, 130],
  weight: [2, 30],
  head: [25, 60],
}

const METRIC_OPTIONS = Object.keys(METRIC_LABELS) as GrowthMetric[]

const GENDER_OPTIONS: Array<{ value: '0' | '1' | '2'; label: string }> = [
  { value: '0', label: '未设置' },
  { value: '1', label: '男' },
  { value: '2', label: '女' },
]

// 月龄精确折算：整月 diff + 剩余天数 / 30.44（月均天数）
function monthAgeOf(birthday: string, dateStr: string): number | null {
  const birth = dayjs(birthday)
  const date = dayjs(dateStr)
  if (!birth.isValid() || !date.isValid()) return null
  const fullMonths = date.diff(birth, 'month')
  const anchor = birth.add(fullMonths, 'month')
  const dayDiff = date.diff(anchor, 'day')
  return fullMonths + dayDiff / 30.44
}

function formatAgeLabel(birthday: string): string {
  const birth = dayjs(birthday)
  if (!birth.isValid()) return ''
  const months = dayjs().diff(birth, 'month')
  if (months < 0) return ''
  if (months < 12) return `${months} 个月`
  const years = Math.floor(months / 12)
  const rest = months % 12
  return rest === 0 ? `${years} 岁` : `${years} 岁 ${rest} 个月`
}

type MeasureDraft = {
  date: string
  value: string
  method: string
}

type ProfileDraft = {
  name: string
  birthday: string
  gender: '0' | '1' | '2'
}

const initialMeasureDraft: MeasureDraft = {
  date: dayjs().format('YYYY-MM-DD'),
  value: '',
  method: '',
}

const initialProfileDraft: ProfileDraft = {
  name: '',
  birthday: '',
  gender: '0',
}

export function Growth() {
  usePageTitle('生长曲线')
  const [activeMetric, setActiveMetric] = useState<GrowthMetric>('weight')
  const [formMetric, setFormMetric] = useState<GrowthMetric>('weight')
  const [draft, setDraft] = useState<MeasureDraft>(initialMeasureDraft)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(initialProfileDraft)
  const [profileSubmitting, setProfileSubmitting] = useState(false)

  const {
    profile,
    measurements,
    loading,
    error,
    fetchProfile,
    upsertProfile,
    fetchMeasurements,
    createMeasurement,
  } = useGrowthStore()

  useEffect(() => {
    void fetchProfile()
    void fetchMeasurements()
  }, [fetchProfile, fetchMeasurements])

  // 档案加载/更新后同步到表单
  useEffect(() => {
    setProfileDraft(profile ? {
      name: profile.name || '',
      birthday: dateOnly(profile.birthday),
      gender: String(profile.gender) as ProfileDraft['gender'],
    } : initialProfileDraft)
  }, [profile])

  // 表单指标跟随当前 tab
  useEffect(() => {
    setFormMetric(activeMetric)
  }, [activeMetric])

  // 切换指标后清空已填数值，避免单位语义错位（如身高 80 带到体重撞限幅）
  useEffect(() => {
    setDraft((current) => ({ ...current, value: '' }))
    setFormError('')
  }, [formMetric])

  const birthday = profile?.birthday ?? null
  const chartSex: ChartSex | null = profile?.gender === 1 ? 'boy' : profile?.gender === 2 ? 'girl' : null

  // 当前指标的图表点：过滤早于生日的测量，按月龄升序
  const chartPoints = useMemo<GrowthChartPoint[]>(() => {
    if (!birthday) return []
    return measurements
      .filter((item) => item.metric === activeMetric)
      .map((item): GrowthChartPoint | null => {
        const monthAge = monthAgeOf(birthday, item.measuredAt)
        if (monthAge === null || monthAge < 0) return null
        return { monthAge, value: item.value, date: item.measuredAt.slice(0, 10) }
      })
      .filter((point): point is GrowthChartPoint => point !== null)
      .sort((a, b) => a.monthAge - b.monthAge)
  }, [activeMetric, birthday, measurements])

  // 最近一次测量在 WHO 标准下的百分位（月龄超出 0-60 时 zScore 返回 null）
  const lastPercentile = useMemo<number | null>(() => {
    if (!chartSex || chartPoints.length === 0) return null
    const last = chartPoints[chartPoints.length - 1]
    const z = zScore(activeMetric, chartSex, last.monthAge, last.value)
    if (z === null) return null
    return Math.round(percentileFromZ(z))
  }, [activeMetric, chartPoints, chartSex])

  // 当前指标的历史记录，日期倒序
  const historyList = useMemo<BabyMeasurement[]>(() => measurements
    .filter((item) => item.metric === activeMetric)
    .sort((a, b) => dayjs(b.measuredAt).valueOf() - dayjs(a.measuredAt).valueOf()), [activeMetric, measurements])

  const ageLabel = useMemo(() => (birthday ? formatAgeLabel(birthday) : ''), [birthday])

  const handleSubmitMeasurement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!draft.date) {
      setFormError('请选择测量日期')
      return
    }
    const value = Number(draft.value)
    if (!draft.value.trim() || Number.isNaN(value)) {
      setFormError(`请输入${METRIC_LABELS[formMetric]}数值`)
      return
    }
    const [min, max] = METRIC_RANGES[formMetric]
    if (value < min || value > max) {
      setFormError(`${METRIC_LABELS[formMetric]}请输入 ${min} - ${max} ${METRIC_UNITS[formMetric]} 之间的数值`)
      return
    }

    setFormError('')
    setSubmitting(true)
    await createMeasurement({
      measuredAt: draft.date,
      metric: formMetric,
      value,
      unit: METRIC_UNITS[formMetric],
      method: draft.method.trim() || undefined,
      clientOperationId: v4(),
    })
    setSubmitting(false)
    if (!useGrowthStore.getState().error) {
      setDraft((current) => ({ ...current, value: '', method: '' }))
    }
  }

  const handleSubmitProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProfileSubmitting(true)
    await upsertProfile({
      name: profileDraft.name.trim() || undefined,
      birthday: profileDraft.birthday || null,
      gender: Number(profileDraft.gender) as 0 | 1 | 2,
    })
    setProfileSubmitting(false)
  }

  const chartEmpty = chartPoints.length === 0 && !chartSex

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Growth</span>
          <h1>生长曲线</h1>
          <p>记录身高、体重、头围，对照 WHO 生长参考带，追踪宝宝一点一滴的成长轨迹。</p>
        </div>
        {lastPercentile !== null ? (
          <span className={styles.percentileBadge}>最近一次位于第 {lastPercentile} 百分位</span>
        ) : null}
      </section>

      <div className={styles.contentGrid}>
        <div className={styles.mainColumn}>
          <section className={styles.card}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.eyebrow}>Chart</span>
                <h2>{METRIC_LABELS[activeMetric]}曲线</h2>
              </div>
              <div className={styles.metricTabs}>
                {METRIC_OPTIONS.map((metric) => (
                  <button
                    key={metric}
                    type="button"
                    className={`${styles.metricTab} ${metric === activeMetric ? styles.metricTabActive : ''}`}
                    onClick={() => setActiveMetric(metric)}
                  >
                    {METRIC_LABELS[metric]}
                  </button>
                ))}
              </div>
            </div>

            {loading ? <div className={styles.loadingBar}>正在同步数据...</div> : null}

            {chartEmpty ? (
              <div className={styles.emptyState}>
                暂无测量记录，完善宝宝生日与性别后，可对照 WHO 参考带
              </div>
            ) : (
              <>
                <GrowthChart
                  metric={activeMetric}
                  sex={chartSex}
                  points={chartPoints}
                  unit={METRIC_UNITS[activeMetric]}
                />
                {chartPoints.length === 0 ? (
                  <div className={styles.emptyState}>暂无{METRIC_LABELS[activeMetric]}记录，在下方录入后即可绘制曲线</div>
                ) : null}
                {chartPoints.length > 0 && !chartSex ? (
                  <div className={styles.chartHint}>完善宝宝生日与性别后，可对照 WHO 参考带</div>
                ) : null}
              </>
            )}
          </section>

          <section className={styles.card}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.eyebrow}>Record</span>
                <h2>录入测量</h2>
              </div>
            </div>

            <form className={styles.form} onSubmit={handleSubmitMeasurement}>
              <div className={styles.formField}>
                <span>指标</span>
                <div className={styles.metricTabs}>
                  {METRIC_OPTIONS.map((metric) => (
                    <button
                      key={metric}
                      type="button"
                      className={`${styles.metricTab} ${metric === formMetric ? styles.metricTabActive : ''}`}
                      onClick={() => setFormMetric(metric)}
                    >
                      {METRIC_LABELS[metric]}
                    </button>
                  ))}
                </div>
              </div>

              <label className={styles.formField}>
                <span>测量日期</span>
                <input
                  type="date"
                  value={draft.date}
                  onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
                />
              </label>

              <label className={styles.formField}>
                <span>数值（{METRIC_UNITS[formMetric]}）</span>
                <input
                  type="number"
                  step="0.1"
                  value={draft.value}
                  onChange={(event) => setDraft((current) => ({ ...current, value: event.target.value }))}
                  placeholder={`${METRIC_LABELS[formMetric]} ${METRIC_RANGES[formMetric][0]} - ${METRIC_RANGES[formMetric][1]} ${METRIC_UNITS[formMetric]}`}
                />
              </label>

              <label className={styles.formField}>
                <span>测量方式（可选）</span>
                <input
                  value={draft.method}
                  onChange={(event) => setDraft((current) => ({ ...current, method: event.target.value }))}
                  placeholder="例如：家用身高尺"
                />
              </label>

              {formError ? <div className={styles.formError}>{formError}</div> : null}
              {error ? <div className={styles.formError}>{error}</div> : null}

              <button type="submit" className={styles.primaryButton} disabled={submitting}>
                {submitting ? '保存中…' : '保存记录'}
              </button>
            </form>
          </section>
        </div>

        <aside className={styles.sidePanel}>
          <section className={styles.panelCard}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.eyebrow}>Baby</span>
                <h2>宝宝档案</h2>
              </div>
            </div>
            {ageLabel ? <p className={styles.ageLine}>当前月龄：{ageLabel}</p> : null}

            <form className={styles.form} onSubmit={handleSubmitProfile}>
              <label className={styles.formField}>
                <span>昵称</span>
                <input
                  value={profileDraft.name}
                  onChange={(event) => setProfileDraft((current) => ({ ...current, name: event.target.value }))}
                  placeholder="宝宝的小名"
                />
              </label>

              <label className={styles.formField}>
                <span>生日</span>
                <input
                  type="date"
                  value={profileDraft.birthday}
                  onChange={(event) => setProfileDraft((current) => ({ ...current, birthday: event.target.value }))}
                />
              </label>

              <label className={styles.formField}>
                <span>性别</span>
                <select
                  value={profileDraft.gender}
                  onChange={(event) => setProfileDraft((current) => ({
                    ...current,
                    gender: event.target.value as ProfileDraft['gender'],
                  }))}
                >
                  {GENDER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <button type="submit" className={styles.secondaryButton} disabled={profileSubmitting}>
                {profileSubmitting ? '保存中…' : '保存档案'}
              </button>
            </form>
          </section>

          <section className={styles.panelCard}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.eyebrow}>History</span>
                <h2>{METRIC_LABELS[activeMetric]}记录</h2>
              </div>
            </div>
            {historyList.length > 0 ? (
              <div className={styles.historyList}>
                {historyList.map((item) => (
                  <article key={item.id} className={styles.historyItem}>
                    <div>
                      <div className={styles.historyDate}>{dayjs(item.measuredAt).format('YYYY-MM-DD')}</div>
                      {item.method ? <p className={styles.historyMethod}>{item.method}</p> : null}
                    </div>
                    <span className={styles.historyValue}>{item.value} {item.unit}</span>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>暂无{METRIC_LABELS[activeMetric]}记录</div>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
