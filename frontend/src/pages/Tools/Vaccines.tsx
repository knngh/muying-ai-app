import { useEffect, useMemo, useState, type FormEvent } from 'react'
import dayjs from 'dayjs'
import { useVaccineStore } from '@/stores/vaccineStore'
import { v4 } from '@/utils/uuid'
import type { VaccinationStatus, VaccineItem } from '@/api/tools'
import { usePageTitle } from '@/hooks'
import styles from './Vaccines.module.css'

type RecordDraft = {
  vaccineName: string
  administeredAt: string
  status: VaccinationStatus
  doseNumber: string
  note: string
}

const initialDraft: RecordDraft = {
  vaccineName: '',
  administeredAt: dayjs().format('YYYY-MM-DD'),
  status: 'administered',
  doseNumber: '',
  note: '',
}

const statusMeta: Record<VaccinationStatus, { label: string; badge: string }> = {
  administered: { label: '已接种', badge: 'statusAdministered' },
  scheduled: { label: '已预约', badge: 'statusScheduled' },
  planned: { label: '计划中', badge: 'statusPlanned' },
  unconfirmed: { label: '待确认', badge: 'statusUnconfirmed' },
}

interface CatalogGroup {
  key: string
  minMonth: number | null
  title: string
  items: VaccineItem[]
}

function categoryBadgeClass(category: string) {
  if (category.includes('一类')) return styles.categoryRequired || ''
  if (category.includes('二类')) return styles.categoryOptional || ''
  return ''
}

export function Vaccines() {
  usePageTitle('疫苗接种')
  const [modalVisible, setModalVisible] = useState(false)
  const [draft, setDraft] = useState<RecordDraft>(initialDraft)
  const [formError, setFormError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [recordView, setRecordView] = useState<'all' | 'pending'>('all')

  const { catalog, records, loading, error, fetchCatalog, fetchRecords, createRecord } = useVaccineStore()

  useEffect(() => {
    void fetchCatalog()
    void fetchRecords()
  }, [fetchCatalog, fetchRecords])

  // 排期分组：minMonth 非空的按 minMonth 升序分组（0=出生时，N=N 月龄），
  // minMonth 为 null/undefined 的归入"时间灵活"组放在最后。
  const catalogGroups = useMemo(() => {
    const timed = catalog
      .filter((item): item is VaccineItem & { minMonth: number } =>
        item.minMonth !== null && item.minMonth !== undefined)
      .sort((a, b) => a.minMonth - b.minMonth)

    const groups: CatalogGroup[] = []
    timed.forEach((item) => {
      const last = groups[groups.length - 1]
      if (last && last.minMonth === item.minMonth) {
        last.items.push(item)
      } else {
        groups.push({
          key: `month-${item.minMonth}`,
          minMonth: item.minMonth,
          title: item.minMonth === 0 ? '出生时' : `${item.minMonth} 月龄`,
          items: [item],
        })
      }
    })

    const flexible = catalog.filter(
      (item) => item.minMonth === null || item.minMonth === undefined
    )
    if (flexible.length > 0) {
      groups.push({ key: 'flexible', minMonth: null, title: '时间灵活', items: flexible })
    }

    return groups
  }, [catalog])

  const sortedRecords = useMemo(
    () =>
      [...records].sort(
        (a, b) => dayjs(b.administeredAt).valueOf() - dayjs(a.administeredAt).valueOf()
      ),
    [records]
  )

  // 待接种 = 计划中/已预约/待确认；按日期升序（临近优先）
  const pendingRecords = useMemo(
    () =>
      records
        .filter((record) => record.status !== 'administered')
        .sort((a, b) => dayjs(a.administeredAt).valueOf() - dayjs(b.administeredAt).valueOf()),
    [records]
  )

  const overdueDays = (dateStr: string): number =>
    dayjs().startOf('day').diff(dayjs(dateStr).startOf('day'), 'day')

  const visibleRecords = recordView === 'pending' ? pendingRecords : sortedRecords

  const openRegisterModal = (vaccineName: string) => {
    setDraft({
      ...initialDraft,
      vaccineName,
      administeredAt: dayjs().format('YYYY-MM-DD'),
    })
    setFormError('')
    setModalVisible(true)
  }

  const handleCloseModal = () => {
    setModalVisible(false)
    setDraft(initialDraft)
    setFormError('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const vaccineName = draft.vaccineName.trim()
    if (!vaccineName) {
      setFormError('请输入疫苗名称')
      return
    }
    if (!draft.administeredAt) {
      setFormError('请选择接种日期')
      return
    }

    let doseNumber: number | undefined
    if (draft.doseNumber.trim() !== '') {
      const parsed = Number(draft.doseNumber)
      if (!Number.isInteger(parsed) || parsed < 1) {
        setFormError('剂次需为不小于 1 的整数')
        return
      }
      doseNumber = parsed
    }

    const created = await createRecord({
      vaccineName,
      administeredAt: draft.administeredAt,
      status: draft.status,
      doseNumber,
      note: draft.note.trim() || undefined,
      clientOperationId: v4(),
    })

    if (created) {
      handleCloseModal()
    }
  }

  const renderVaccineItem = (vaccine: VaccineItem) => {
    const expanded = expandedId === vaccine.id

    const metaParts: string[] = []
    if (vaccine.doseCount !== null && vaccine.doseCount !== undefined) {
      metaParts.push(`共 ${vaccine.doseCount} 剂`)
    }
    if (vaccine.preventDisease) {
      metaParts.push(`预防：${vaccine.preventDisease}`)
    }

    const details: Array<{ label: string; text: string }> = []
    if (vaccine.description) details.push({ label: '说明', text: vaccine.description })
    if (vaccine.preventDisease) details.push({ label: '预防疾病', text: vaccine.preventDisease })
    if (vaccine.sideEffects) details.push({ label: '常见反应', text: vaccine.sideEffects })
    if (vaccine.contraindication) details.push({ label: '接种禁忌', text: vaccine.contraindication })

    return (
      <div key={vaccine.id} className={styles.vaccineItem}>
        <button
          type="button"
          className={styles.vaccineRow}
          onClick={() => setExpandedId(expanded ? null : vaccine.id)}
        >
          <span className={styles.vaccineTitleRow}>
            <strong>{vaccine.name}</strong>
            <span className={`${styles.categoryBadge} ${categoryBadgeClass(vaccine.category)}`}>
              {vaccine.category}
            </span>
          </span>
          <span className={styles.vaccineMetaRow}>
            {metaParts.length > 0 ? (
              <span className={styles.vaccineMeta}>{metaParts.join(' · ')}</span>
            ) : (
              <span />
            )}
            <span className={styles.expandHint}>{expanded ? '收起 ▴' : '展开 ▾'}</span>
          </span>
        </button>

        {expanded ? (
          <div className={styles.vaccineDetail}>
            {details.length > 0 ? (
              details.map((detail) => (
                <p key={detail.label} className={styles.detailText}>
                  <span className={styles.detailLabel}>{detail.label}</span>
                  {detail.text}
                </p>
              ))
            ) : (
              <p className={styles.detailText}>暂无详细说明</p>
            )}
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => openRegisterModal(vaccine.name)}
            >
              登记接种
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Vaccines</span>
          <h1>疫苗接种</h1>
          <p>按月龄查看疫苗接种排期，登记宝宝的每一剂接种记录，免疫进度一目了然。</p>
        </div>
      </section>

      <div className={styles.noticeBar}>
        接种排期仅供参考，实际剂次、时间与可替换方案以接种门诊和疾控部门安排为准。
      </div>

      {error ? <div className={styles.errorBar}>{error}</div> : null}

      <div className={styles.contentGrid}>
        <section className={styles.scheduleCard}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>Schedule</span>
              <h2>接种排期</h2>
            </div>
          </div>

          {loading && catalog.length === 0 ? (
            <div className={styles.loadingBar}>正在加载疫苗目录...</div>
          ) : null}

          {!loading && catalog.length === 0 ? (
            <div className={styles.emptyState}>暂未加载到疫苗目录</div>
          ) : (
            <div className={styles.groupList}>
              {catalogGroups.map((group) => (
                <section key={group.key} className={styles.groupBlock}>
                  <h3 className={styles.groupTitle}>{group.title}</h3>
                  <div className={styles.vaccineList}>
                    {group.items.map(renderVaccineItem)}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>

        <aside className={styles.sidePanel}>
          <section className={styles.panelCard}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.eyebrow}>Records</span>
                <h2>我的接种记录</h2>
              </div>
            </div>

            <div className={styles.viewTabs}>
              <button
                type="button"
                className={recordView === 'all' ? `${styles.viewTab} ${styles.viewTabActive}` : styles.viewTab}
                onClick={() => setRecordView('all')}
              >
                全部 ({records.length})
              </button>
              <button
                type="button"
                className={recordView === 'pending' ? `${styles.viewTab} ${styles.viewTabActive}` : styles.viewTab}
                onClick={() => setRecordView('pending')}
              >
                待接种 ({pendingRecords.length})
              </button>
            </div>

            {loading && records.length === 0 ? (
              <div className={styles.loadingBar}>正在加载接种记录...</div>
            ) : null}

            {visibleRecords.length > 0 ? (
              <div className={styles.recordList}>
                {visibleRecords.map((record) => {
                  const overdue = recordView === 'pending' ? overdueDays(record.administeredAt) : 0
                  return (
                    <article key={record.id} className={styles.recordItem}>
                      <div className={styles.recordTitleRow}>
                        <strong>{record.vaccineName}</strong>
                        <span
                          className={`${styles.statusBadge} ${
                            styles[statusMeta[record.status].badge] || ''
                          }`}
                        >
                          {statusMeta[record.status].label}
                        </span>
                      </div>
                      <p>
                        {recordView === 'pending' ? '计划' : ''}{record.administeredAt}
                        {record.doseNumber ? ` · 第 ${record.doseNumber} 剂` : ''}
                        {overdue > 0 ? <span className={styles.overdueHint}> 已过 {overdue} 天</span> : null}
                      </p>
                      {record.note ? <p>{record.note}</p> : null}
                      {recordView === 'pending' ? (
                        <button
                          type="button"
                          className={styles.markButton}
                          onClick={() => openRegisterModal(record.vaccineName)}
                        >
                          去登记接种
                        </button>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            ) : !loading ? (
              <div className={styles.emptyState}>
                {recordView === 'pending' && records.length > 0
                  ? '没有待接种的记录，都很按时 👍'
                  : '暂无接种记录，展开排期中的疫苗即可登记'}
              </div>
            ) : null}

            <p className={styles.footnote}>
              记录创建后暂不支持修改或删除；完成接种后可再登记一条「已接种」记录，原计划记录会保留作对照。
            </p>
          </section>
        </aside>
      </div>

      {modalVisible ? (
        <div className={styles.modalOverlay} onClick={handleCloseModal}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.eyebrow}>Record</span>
                <h2>登记接种</h2>
              </div>
              <button type="button" className={styles.textButton} onClick={handleCloseModal}>
                关闭
              </button>
            </div>

            <form className={styles.form} onSubmit={handleSubmit}>
              <label className={styles.formField}>
                <span>疫苗名称</span>
                <input
                  value={draft.vaccineName}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, vaccineName: event.target.value }))
                  }
                  placeholder="例如：乙肝疫苗"
                />
              </label>

              <label className={styles.formField}>
                <span>接种日期</span>
                <input
                  type="date"
                  value={draft.administeredAt}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, administeredAt: event.target.value }))
                  }
                />
              </label>

              <label className={styles.formField}>
                <span>状态</span>
                <select
                  value={draft.status}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      status: event.target.value as VaccinationStatus,
                    }))
                  }
                >
                  {Object.entries(statusMeta).map(([value, meta]) => (
                    <option key={value} value={value}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.formField}>
                <span>剂次（可选）</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={draft.doseNumber}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, doseNumber: event.target.value }))
                  }
                  placeholder="例如：1"
                />
              </label>

              <label className={styles.formField}>
                <span>备注（可选）</span>
                <input
                  value={draft.note}
                  onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
                  placeholder="接种机构、疫苗批号等"
                />
              </label>

              {formError || error ? (
                <div className={styles.formError}>{formError || error}</div>
              ) : null}

              <button type="submit" className={styles.primaryButton} disabled={loading}>
                {loading ? '登记中...' : '登记接种'}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
