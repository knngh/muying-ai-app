import { Link } from 'react-router-dom'
import { usePageTitle } from '@/hooks'
import styles from './Tools.module.css'

const TOOL_CARDS = [
  {
    path: '/tools/growth',
    category: '成长记录',
    title: '生长曲线',
    description: '记录身高、体重和头围，沿时间线回看宝宝的成长。',
    action: '记录生长数据',
    detail: 'WHO 生长参考 · 历史测量',
    tone: 'green',
    icon: 'M4 4v16h16 M7 14l4-4 4 2 5-7',
  },
  {
    path: '/tools/vaccines',
    category: '接种安排',
    title: '疫苗接种',
    description: '按月龄查看接种计划，记录已接种项目与下一次安排。',
    action: '查看接种计划',
    detail: '月龄排期 · 接种记录',
    tone: 'green',
    icon: 'M8 3v4 M16 3v4 M4 10h16 M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1 M8 15l3 3 5-5',
  },
  {
    path: '/tools/names',
    category: '家庭准备',
    title: '宝宝起名',
    description: '按姓氏与偏好挑选候选名字，收藏后和家人慢慢讨论。',
    action: '挑选候选名字',
    detail: '拼音与寓意 · 心仪收藏',
    tone: 'orange',
    icon: 'M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1v15 M6 8h3 M15 8h3 M6 12h3 M15 12h3',
  },
  {
    path: '/tools/checkin',
    category: '日常陪伴',
    title: '每日打卡',
    description: '每天留下一次签到，查看连续打卡天数与积分记录。',
    action: '完成今日打卡',
    detail: '连续签到 · 积分记录',
    tone: 'orange',
    icon: 'M20 11v9H4V4h11 M8 11l4 4 9-10',
  },
]

export function Tools() {
  usePageTitle('孕育工具箱')

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>日常记录 · 阶段准备</span>
          <h1>孕育工具箱</h1>
          <p>记录成长、安排接种，也为家人的每一步准备留个位置。</p>
        </div>
        <Link className={styles.calendarLink} to="/calendar">查看孕育日历 <span aria-hidden="true">↗</span></Link>
      </section>

      <section aria-labelledby="tools-heading">
        <div className={styles.sectionHeading}>
          <h2 id="tools-heading">选择需要的工具</h2>
          <span>4 项常用工具</span>
        </div>
        <div className={styles.cardGrid}>
          {TOOL_CARDS.map((card) => (
            <Link key={card.path} to={card.path} className={styles.toolCard} aria-label={`打开${card.title}`}>
              <div className={styles.cardHeading}>
                <span className={`${styles.icon} ${styles[card.tone]}`} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={card.icon} /></svg>
                </span>
                <div><span className={styles.category}>{card.category}</span><h3>{card.title}</h3></div>
                <span className={styles.arrow} aria-hidden="true">↗</span>
              </div>
              <p>{card.description}</p>
              <span className={styles.detail}>{card.detail}</span>
              <span className={styles.openHint}>{card.action} <span aria-hidden="true">→</span></span>
            </Link>
          ))}
        </div>
      </section>
      <p className={styles.note}>生长参考和接种计划用于记录与核对，具体安排请与儿保或接种门诊确认。</p>
    </div>
  )
}
