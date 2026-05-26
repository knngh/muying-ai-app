import { buildTimelineKey, type TimelinePeriod } from './timeline';

export interface TimelineTodoTemplate {
  todoKey: string;
  title: string;
  desc: string;
  type: 'checkup' | 'vaccine' | 'feeding' | 'development' | 'safety' | 'care';
  sourceLabel: string;
}

interface TimelineTodoDefinition extends TimelineTodoTemplate {
  startWeek: number;
  endWeek: number;
}

const CHILD_HEALTH_SOURCE = '0-6岁儿童健康管理服务规范';
const VACCINE_SOURCE = '国家免疫规划疫苗儿童免疫程序';
const CARE_SOURCE = '贝护妈妈产后与婴幼儿照护清单';

const POSTPARTUM_TODO_DEFINITIONS: TimelineTodoDefinition[] = [
  {
    startWeek: 1,
    endWeek: 1,
    todoKey: 'newborn-home-visit',
    title: '确认新生儿访视',
    desc: '重点记录吃奶、体温、黄疸、脐带和大小便情况，有异常及时线下咨询。',
    type: 'checkup',
    sourceLabel: CHILD_HEALTH_SOURCE,
  },
  {
    startWeek: 1,
    endWeek: 4,
    todoKey: 'feeding-output-log',
    title: '记录喂养和排尿排便',
    desc: '每天留意吃奶频率、尿量、排便和精神状态，作为复诊或咨询时的基础信息。',
    type: 'feeding',
    sourceLabel: CARE_SOURCE,
  },
  {
    startWeek: 1,
    endWeek: 6,
    todoKey: 'postpartum-recovery-log',
    title: '记录妈妈产后恢复',
    desc: '记录恶露、伤口、乳房胀痛、情绪和睡眠，产后复查前集中回看。',
    type: 'care',
    sourceLabel: CARE_SOURCE,
  },
  {
    startWeek: 5,
    endWeek: 6,
    todoKey: 'postpartum-42-day-check',
    title: '安排产后 42 天复查',
    desc: '复查前整理伤口、恶露、盆底、哺乳和情绪状态，便于医生判断恢复情况。',
    type: 'checkup',
    sourceLabel: CARE_SOURCE,
  },
  {
    startWeek: 5,
    endWeek: 6,
    todoKey: 'one-month-checkup',
    title: '完成满月健康检查',
    desc: '核对体重增长、黄疸回落、喂养方式和睡眠节奏。',
    type: 'checkup',
    sourceLabel: CHILD_HEALTH_SOURCE,
  },
  {
    startWeek: 5,
    endWeek: 6,
    todoKey: 'one-month-vaccine',
    title: '核对 1 月龄疫苗',
    desc: '与接种门诊确认乙肝第 2 剂等本地接种安排。',
    type: 'vaccine',
    sourceLabel: VACCINE_SOURCE,
  },
  {
    startWeek: 9,
    endWeek: 9,
    todoKey: 'two-month-vaccine',
    title: '核对 2 月龄疫苗',
    desc: '按接种门诊安排核对脊灰等程序，记录接种后状态。',
    type: 'vaccine',
    sourceLabel: VACCINE_SOURCE,
  },
  {
    startWeek: 13,
    endWeek: 14,
    todoKey: 'three-month-checkup',
    title: '完成 3 月龄健康检查',
    desc: '关注体格生长、抬头、追视、互动和喂养节奏。',
    type: 'checkup',
    sourceLabel: CHILD_HEALTH_SOURCE,
  },
  {
    startWeek: 13,
    endWeek: 14,
    todoKey: 'three-month-vaccine',
    title: '核对 3 月龄疫苗',
    desc: '与接种门诊确认脊灰、百白破等本地程序。',
    type: 'vaccine',
    sourceLabel: VACCINE_SOURCE,
  },
  {
    startWeek: 17,
    endWeek: 18,
    todoKey: 'four-month-vaccine',
    title: '核对 4 月龄疫苗',
    desc: '记录接种日期、接种后发热或局部反应，并按需咨询接种门诊。',
    type: 'vaccine',
    sourceLabel: VACCINE_SOURCE,
  },
  {
    startWeek: 22,
    endWeek: 23,
    todoKey: 'five-month-vaccine',
    title: '核对 5 月龄疫苗',
    desc: '确认百白破等后续剂次是否已安排，保留接种记录。',
    type: 'vaccine',
    sourceLabel: VACCINE_SOURCE,
  },
  {
    startWeek: 25,
    endWeek: 27,
    todoKey: 'six-month-checkup',
    title: '完成 6 月龄健康检查',
    desc: '核对身高体重、发育表现、喂养方式和辅食准备。',
    type: 'checkup',
    sourceLabel: CHILD_HEALTH_SOURCE,
  },
  {
    startWeek: 25,
    endWeek: 30,
    todoKey: 'solid-food-start',
    title: '建立辅食记录',
    desc: '记录新增食物、进食量、皮疹呕吐腹泻等反应，循序渐进推进。',
    type: 'feeding',
    sourceLabel: CARE_SOURCE,
  },
  {
    startWeek: 35,
    endWeek: 36,
    todoKey: 'eight-month-checkup',
    title: '完成 8 月龄健康检查',
    desc: '重点回看辅食、翻爬坐立、出牙和亲子互动。',
    type: 'checkup',
    sourceLabel: CHILD_HEALTH_SOURCE,
  },
  {
    startWeek: 35,
    endWeek: 39,
    todoKey: 'eight-nine-month-vaccine',
    title: '核对 8-9 月龄疫苗',
    desc: '按当地门诊安排确认麻腮风、乙脑、流脑等程序。',
    type: 'vaccine',
    sourceLabel: VACCINE_SOURCE,
  },
  {
    startWeek: 52,
    endWeek: 54,
    todoKey: 'twelve-month-checkup',
    title: '完成 12 月龄健康检查',
    desc: '复盘站立行走、睡眠、进食、牙齿和一岁节点发育里程碑。',
    type: 'checkup',
    sourceLabel: CHILD_HEALTH_SOURCE,
  },
  {
    startWeek: 70,
    endWeek: 80,
    todoKey: 'eighteen-month-checkup-vaccine',
    title: '核对 18 月龄体检和疫苗',
    desc: '关注语言起步、走跑、进食边界，并核对加强针安排。',
    type: 'checkup',
    sourceLabel: CHILD_HEALTH_SOURCE,
  },
  {
    startWeek: 96,
    endWeek: 108,
    todoKey: 'two-year-checkup',
    title: '完成 2 岁健康检查',
    desc: '重点记录语言、如厕准备、行为边界、牙齿和营养情况。',
    type: 'development',
    sourceLabel: CHILD_HEALTH_SOURCE,
  },
  {
    startWeek: 120,
    endWeek: 134,
    todoKey: 'thirty-month-checkup',
    title: '完成 30 月龄健康检查',
    desc: '复盘语言、社交、睡眠、挑食和家庭规则建立。',
    type: 'development',
    sourceLabel: CHILD_HEALTH_SOURCE,
  },
  {
    startWeek: 148,
    endWeek: 156,
    todoKey: 'three-year-checkup',
    title: '完成 3 岁健康检查',
    desc: '关注视力、听力、语言、社交、如厕和入园准备。',
    type: 'development',
    sourceLabel: CHILD_HEALTH_SOURCE,
  },
];

export function getPostpartumTimelineTodos(period: TimelinePeriod): TimelineTodoTemplate[] {
  if (period.stage !== 'postpartum') {
    return [];
  }

  return POSTPARTUM_TODO_DEFINITIONS
    .filter((item) => period.week >= item.startWeek && period.week <= item.endWeek)
    .map(({ startWeek: _startWeek, endWeek: _endWeek, ...item }) => ({
      ...item,
      todoKey: `${buildTimelineKey('postpartum', period.week)}:${item.todoKey}`,
    }));
}
