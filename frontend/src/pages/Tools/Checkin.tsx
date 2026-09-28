import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { useCheckinStore } from '@/stores/checkinStore'
import type { CheckinResult } from '@/api/tools'
import styles from './Checkin.module.css'

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']

export function Checkin() {
  const [result, setResult] = useState<CheckinResult | null>(null)

  const {
    status,
    logList,
    logPage,
    logTotalPages,
    logLoading,
    loading,
    error,
    fetchStatus,
    performCheckin,
    fetchLogPage,
  } = useCheckinStore()

  useEffect(() => {
    fetchStatus()
    fetchLogPage(1)
  }, [fetchStatus, fetchLogPage])

  const checkinSet = useMemo(() => new Set(status?.monthlyCheckins ?? []), [status?.monthlyCheckins])
  const recentStreakDates = useMemo(
    () => [...(status?.streakDates ?? [])].sort((a, b) => b.localeCompare(a)).slice(0, 14),
    [status?.streakDates]
  )

  const monthStart = dayjs().startOf('month')
  const monthLabel = monthStart.format('YYYY年MM月')
  const todayStr = dayjs().format('YYYY-MM-DD')
  const leadingBlanks = Array.from({ length: (monthStart.day() + 6) % 7 })
  const monthDays = Array.from({ length: monthStart.daysInMonth() }, (_, index) => monthStart.add(index, 'day'))

  const handleCheckin = async () => {
    const checkinResult = await performCheckin()
    if (checkinResult) setResult(checkinResult)
  }

  const handleLoadMore = () => {
    fetchLogPage(logPage + 1, true)
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Check-in</span>
          <h1>每日打卡</h1>
          <p>每天签到攒积分，连续打卡有额外奖励，坚持本身就是一种照顾。</p>
        </div>
      </section>

      <div className={styles.contentGrid}>
        <div className={styles.leftPanel}>
          <section className={styles.card}>
            {loading ? <div className={styles.loadingBar}>正在加载签到状态...</div> : null}

            <button
              type="button"
              className={`${styles.primaryButton} ${styles.bigButton}`}
              disabled={loading || (status?.checkedInToday ?? false)}
              onClick={handleCheckin}
            >
              {status?.checkedInToday ? '今日已签到 ✓' : '今日签到'}
            </button>

            <div className={styles.statsGrid}>
              <div className={styles.statCell}>
                <span className={styles.statValue}>{status?.currentStreak ?? 0}</span>
                <span className={styles.statLabel}>连续打卡 · 天</span>
              </div>
              <div className={styles.statCell}>
                <span className={styles.statValue}>{status?.totalDays ?? 0}</span>
                <span className={styles.statLabel}>累计打卡 · 天</span>
              </div>
              <div className={styles.statCell}>
                <span className={styles.statValue}>{status?.totalPoints ?? 0}</span>
                <span className={styles.statLabel}>累计积分 · 分</span>
              </div>
            </div>

            <p className={styles.bonusHint}>
              {status
                ? status.nextBonusAt && status.nextBonusPoints
                  ? `再连续 ${status.nextBonusAt - status.currentStreak} 天可额外得 +${status.nextBonusPoints} 积分`
                  : '已解锁全部连签奖励'
                : ''}
            </p>

            {result ? (
              <div className={styles.loadingBar}>
                {result.alreadyCheckedIn ? '今天已经签到过啦' : `签到成功 +${result.pointsEarned} 积分`}
              </div>
            ) : null}

            {error ? <div className={styles.errorBar}>{error}</div> : null}
          </section>

          <section className={styles.card}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.eyebrow}>This Month</span>
                <h2>本月签到</h2>
              </div>
              <span className={styles.monthLabel}>{monthLabel}</span>
            </div>

            <div className={styles.weekHeader}>
              {WEEK_LABELS.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            <div className={styles.monthGrid}>
              {leadingBlanks.map((_, index) => (
                <div key={`blank-${index}`} className={styles.dayCellBlank} />
              ))}
              {monthDays.map((date) => {
                const dateStr = date.format('YYYY-MM-DD')
                return (
                  <div
                    key={dateStr}
                    className={[styles.dayCell, dateStr === todayStr ? styles.dayCellToday : '']
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <span className={styles.dayNumber}>{date.date()}</span>
                    <span className={checkinSet.has(dateStr) ? styles.checkinDot : styles.dotPlaceholder} />
                  </div>
                )
              })}
            </div>

            <div className={styles.streakSection}>
              <span className={styles.streakTitle}>近期连签</span>
              <div className={styles.streakChips}>
                {recentStreakDates.length > 0 ? (
                  recentStreakDates.map((date) => (
                    <span key={date} className={styles.streakChip}>
                      {date}
                    </span>
                  ))
                ) : (
                  <span className={styles.streakEmpty}>暂无连签记录</span>
                )}
              </div>
            </div>
          </section>
        </div>

        <aside className={styles.card}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>Points</span>
              <h2>积分流水</h2>
            </div>
            <div className={styles.balanceBadge}>
              <span className={styles.balanceValue}>{status?.totalPoints ?? 0}</span>
              <span className={styles.balanceLabel}>当前积分</span>
            </div>
          </div>

          {!logLoading && logList.length === 0 ? (
            <div className={styles.emptyState}>暂无积分记录，从今天开始签到吧</div>
          ) : (
            <div className={styles.logList}>
              {logList.map((entry) => (
                <div key={entry.id} className={styles.logItem}>
                  <span className={entry.points >= 0 ? styles.pointsPositive : styles.pointsNegative}>
                    {entry.points > 0 ? `+${entry.points}` : entry.points}
                  </span>
                  <div className={styles.logInfo}>
                    <span className={styles.logDescription}>{entry.description}</span>
                    <span className={styles.logDate}>{dayjs(entry.createdAt).format('YYYY-MM-DD')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {logPage < logTotalPages ? (
            <button type="button" className={styles.secondaryButton} disabled={logLoading} onClick={handleLoadMore}>
              {logLoading ? '加载中...' : '加载更多'}
            </button>
          ) : logList.length > 0 ? (
            <div className={styles.noMore}>没有更多了</div>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
