import { useCallback, useState } from 'react'
import { Button } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { MILESTONES, BIRTH_MILESTONE } from '@/data/birthCardMilestones'
import styles from './BirthCard.module.css'

interface TimelineAnimationProps {
  pregnancyStartDate: string
  birthDate: string
  babyGender?: string
}

const CELEBRATE_EMOJIS = ['🎉', '✨', '🎀', '💖', '🌟']

export function TimelineAnimation({
  pregnancyStartDate,
  birthDate,
  babyGender,
}: TimelineAnimationProps) {
  const [key, setKey] = useState(0)

  const start = dayjs(pregnancyStartDate)
  const birth = dayjs(birthDate)
  const totalWeeks = Math.floor(birth.diff(start, 'day') / 7)

  const visibleMilestones = MILESTONES.filter((m) => m.week <= totalWeeks)

  const handleReplay = useCallback(() => {
    setKey((k) => k + 1)
  }, [])

  return (
    <div className={styles.timelineContainer} key={key}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          {start.format('YYYY.MM.DD')} → {birth.format('YYYY.MM.DD')}
        </div>
        <div className={styles.headerSubtitle}>{totalWeeks} 周的爱与等待</div>
      </div>

      {/* Timeline */}
      <div className={styles.timeline}>
        <div className={styles.timelineLine} />
        <div className={styles.timelineProgress} />

        {visibleMilestones.map((milestone, index) => (
          <div
            key={milestone.week}
            className={styles.milestoneNode}
            style={{ '--index': index } as React.CSSProperties}
          >
            <div className={styles.milestoneDot}>{milestone.emoji}</div>
            <div className={styles.milestoneCard}>
              <div className={styles.milestoneWeek}>第 {milestone.week} 周</div>
              <div className={styles.milestoneSize}>
                {milestone.emoji} {milestone.sizeLabel}
              </div>
              <div className={styles.milestoneDesc}>{milestone.description}</div>
              {(milestone.sizeCm || milestone.weightG) && (
                <div className={styles.milestoneStats}>
                  {milestone.sizeCm && <span>约 {milestone.sizeCm} cm</span>}
                  {milestone.weightG && <span>约 {milestone.weightG} g</span>}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Birth node */}
        <div
          className={styles.birthNode}
          style={{ '--index': visibleMilestones.length } as React.CSSProperties}
        >
          <div className={styles.birthDot}>{BIRTH_MILESTONE.emoji}</div>
          <div className={styles.birthCard}>
            <div className={styles.particles}>
              {CELEBRATE_EMOJIS.map((emoji, i) => (
                <span key={i} className={styles.particle}>
                  {emoji}
                </span>
              ))}
            </div>
            <div className={styles.birthEmoji}>{BIRTH_MILESTONE.emoji}</div>
            <div className={styles.birthTitle}>{BIRTH_MILESTONE.title}</div>
            <div className={styles.birthBlessing}>
              {BIRTH_MILESTONE.getBlessing(babyGender)}
            </div>
          </div>
        </div>
      </div>

      {/* Replay */}
      <Button
        className={styles.replayButton}
        icon={<ReloadOutlined />}
        onClick={handleReplay}
      >
        重新播放
      </Button>
    </div>
  )
}
