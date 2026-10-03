import { useNavigate } from 'react-router-dom'
import { usePageTitle } from '@/hooks'
import styles from './Tools.module.css'

const TOOL_CARDS = [
  {
    path: '/tools/growth',
    hint: 'Growth',
    title: '生长曲线',
    description: '记录身高、体重、头围，对照 WHO 生长参考带，看宝宝一直以来的成长轨迹。',
  },
  {
    path: '/tools/vaccines',
    hint: 'Vaccines',
    title: '疫苗接种',
    description: '按月龄查看接种排期，登记宝宝的接种记录，安排和回看一目了然。',
  },
  {
    path: '/tools/checkin',
    hint: 'Check-in',
    title: '每日打卡',
    description: '每天签到攒积分，连续打卡有额外奖励，坚持本身就是一种照顾。',
  },
  {
    path: '/tools/names',
    hint: 'Names',
    title: '宝宝起名',
    description: '按姓氏、性别偏好筛选候选名，附拼音、寓意与出处，收藏心仪的名字。',
  },
]

export function Tools() {
  usePageTitle('孕育工具箱')
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Toolbox</span>
          <h1>孕育工具箱</h1>
          <p>记录、对照、坚持——把零散的养育小事收进一个入口，慢慢积累成看得见的安心。</p>
        </div>
      </section>

      <div className={styles.cardGrid}>
        {TOOL_CARDS.map((card) => (
          <button key={card.path} type="button" className={styles.toolCard} onClick={() => navigate(card.path)}>
            <span className={styles.eyebrow}>{card.hint}</span>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
            <span className={styles.openHint}>打开工具 →</span>
          </button>
        ))}
      </div>
    </div>
  )
}
