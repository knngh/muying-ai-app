import { Link } from 'react-router-dom'
import { usePageTitle } from '@/hooks'
import styles from './Home.module.css'

const stages = [
  { name: '准备怀孕', detail: '备孕与生活准备', value: 'preparation' },
  { name: '孕早期', detail: '1–12 周', value: 'first-trimester' },
  { name: '孕中期', detail: '13–27 周', value: 'second-trimester' },
  { name: '孕晚期', detail: '28–40 周', value: 'third-trimester' },
  { name: '产后恢复', detail: '照顾宝宝，也照顾自己', value: 'postpartum' },
  { name: '宝宝 0–6 月', detail: '喂养与新生儿照护', value: '0-6-months' },
  { name: '宝宝 6–12 月', detail: '辅食与成长探索', value: '6-12-months' },
  { name: '孩子 1–3 岁', detail: '发育与日常养育', value: '1-3-years' },
]

const features = [
  { number: '01', title: '有疑问，先查有出处的知识', description: '按孕育阶段和主题查找科普，查看来源机构、原文与日期，让每一次了解都有据可循。', label: '查找孕育知识', to: '/knowledge', note: '免费阅读 · 无需登录' },
  { number: '02', title: '说出困惑，一起整理思路', description: '向 AI 描述你的问题，梳理需要关注的事情，带着更清楚的问题与专业人员沟通。', label: '开始 AI 问答', to: '/chat', note: '登录后使用' },
  { number: '03', title: '把重要的日子记下来', description: '记录产检、接种和生活安排，在孕育日历里查看接下来的计划。', label: '查看孕育日历', to: '/calendar', note: '登录后使用' },
  { number: '04', title: '让日常记录更轻松', description: '用生长曲线了解宝宝的成长，查看疫苗参考安排，也可以每日打卡、寻找名字灵感。', label: '打开工具箱', to: '/tools', note: '登录后使用' },
]

export function Home() {
  usePageTitle('贝护妈妈 · 陪伴每一步孕育日常')
  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="home-title">
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>贝护妈妈 · 你的孕育日常助手</span>
          <h1 id="home-title">孕育路上，<br />多一份了解，<br /><span>少一点慌张。</span></h1>
          <p className={styles.intro}>从准备怀孕到宝宝长大，把有出处的知识、随时可问的 AI 和日常记录放在一起，陪你一步一步找到适合自己的节奏。</p>
          <div className={styles.actions}>
            <Link className={styles.primaryLink} to="/knowledge">浏览知识库 <span aria-hidden="true">↗</span></Link>
            <a className={styles.secondaryLink} href="#everyday">了解怎么用 <span aria-hidden="true">↓</span></a>
          </div>
          <p className={styles.heroNote}>知识免费开放，记录与问答登录后使用。</p>
        </div>
        <div className={styles.startPanel}>
          <div className={styles.panelIntro}>
            <span className={styles.smallLabel}>从一个小问题开始</span>
            <div className={styles.careMark} aria-hidden="true">♡</div>
            <h2>今天，你想了解什么？</h2>
            <p>关于自己，也关于正在长大的宝宝。</p>
          </div>
          <div className={styles.questionLinks}>
            {[
              ['备孕与孕期', '叶酸怎么补，饮食怎么安排？', '叶酸'],
              ['宝宝的日常', '母乳喂养和辅食有哪些要点？', '喂养'],
              ['妈妈的照护', '产后怎样循序渐进地恢复？', '产后恢复'],
            ].map(([label, question, keyword]) => (
              <Link key={keyword} to={`/knowledge?keyword=${encodeURIComponent(keyword)}`}>
                <span><small>{label}</small><strong>{question}</strong></span><span aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
          <p className={styles.panelFoot}>先了解，再记录；需要时，寻求专业帮助。</p>
        </div>
      </section>

      <section className={styles.stageSection} aria-labelledby="stage-title">
        <div className={styles.sectionHeading}>
          <div><span className={styles.eyebrow}>每个阶段，都有值得了解的事</span><h2 id="stage-title">从你现在的阶段开始</h2></div>
          <Link to="/knowledge">查看全部知识 <span aria-hidden="true">→</span></Link>
        </div>
        <div className={styles.stages}>
          {stages.map(stage => (
            <Link key={stage.value} to={`/knowledge?stage=${stage.value}`}>
              <strong>{stage.name}</strong><span>{stage.detail}</span><span className={styles.stageArrow} aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      </section>

      <section id="everyday" className={styles.everyday} aria-labelledby="everyday-title">
        <div className={styles.sectionHeading}>
          <div><span className={styles.eyebrow}>了解 · 提问 · 计划 · 记录</span><h2 id="everyday-title">让每一天，更有头绪</h2></div>
          <p>从查一个问题，到记下一次成长。</p>
        </div>
        <div className={styles.features}>
          {features.map(feature => (
            <div className={styles.feature} key={feature.number}>
              <span className={styles.featureNumber}>{feature.number}</span>
              <div><h3>{feature.title}</h3><p>{feature.description}</p><span className={styles.featureNote}>{feature.note}</span></div>
              <Link to={feature.to}>{feature.label} <span aria-hidden="true">↗</span></Link>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.sources} aria-labelledby="sources-title">
        <div><span className={styles.eyebrow}>了解内容从哪里来</span><h2 id="sources-title">知识有出处，阅读有依据。</h2><p>知识库收集 WHO、NHS 等机构发布的孕育与育儿资料。中文原文与外文来源分别标注，你可以回到原文核对具体建议和适用背景。</p><Link to="/knowledge?language=zh">查看中文原文内容 <span aria-hidden="true">→</span></Link></div>
        <ul>
          <li><strong>先看是否适合你</strong><span>按阶段、主题选择，优先了解日常照护建议。</span></li>
          <li><strong>再看原始出处</strong><span>留意来源机构、原文语言及发布或更新日期。</span></li>
          <li><strong>需要时咨询专业人员</strong><span>知识和 AI 用于帮助理解，个体诊疗请与医生讨论。</span></li>
        </ul>
      </section>
    </div>
  )
}
