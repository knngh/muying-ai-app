import dayjs from 'dayjs';
import type { StandardSchedulePlan, StandardScheduleItem } from '../types/standard-schedule';
import { resolveLifecycleStage } from './pregnancy';

type SupportedLifecycleKey =
  | 'preparing'
  | 'pregnant'
  | 'postpartum_newborn'
  | 'postpartum_recovery'
  | 'infant_0_6'
  | 'infant_6_12'
  | 'toddler_1_3'
  | 'child_3_plus';

type StandardSourceKey = 'postpartum' | 'checkup' | 'vaccine' | 'prenatal';

type StandardScheduleDefinition = {
  key: string;
  title: string;
  description: string;
  eventType: 'checkup' | 'vaccine' | 'reminder';
  sourceKey: StandardSourceKey;
  sourceLabel: string;
  offsetDays?: number;
  offsetMonths?: number;
  dateLabel: string;
  stageKeys: SupportedLifecycleKey[];
};

type UserLifecycleProfile = {
  pregnancyStatus?: number | null;
  dueDate?: Date | null;
  babyBirthday?: Date | null;
};

type ExistingStandardEvent = {
  id: bigint | number;
  reminderType?: string | null;
  status?: number | null;
};

export type StandardSchedulePreviewItem = StandardScheduleItem;

const STANDARD_REMINDER_MINUTES = 12 * 60;

const PRENATAL_SOURCE_LABEL = '国家孕产妇健康管理规范';
const POSTPARTUM_SOURCE_LABEL = '国家基本公共卫生产后访视';
const CHILD_CHECK_SOURCE_LABEL = '国家基本公共卫生儿童健康管理';
const VACCINE_SOURCE_LABEL = '国家免疫规划接种程序';

// Prenatal events use negative offsetDays relative to dueDate.
// offsetDays = -(280 - targetGestationalDays)
// e.g. 12 weeks = 84 days gestation → offsetDays = -(280 - 84) = -196
const PRENATAL_SCHEDULE_DEFINITIONS: StandardScheduleDefinition[] = [
  {
    key: 'std-pn12',
    title: '建档 & 首次产检',
    description: '孕 12 周前建议完成建档和首次系统产检，包括血常规、尿常规、肝肾功能、血型、传染病筛查等。',
    eventType: 'checkup',
    sourceKey: 'prenatal',
    sourceLabel: PRENATAL_SOURCE_LABEL,
    offsetDays: -196, // 280 - 84(12w)
    dateLabel: '孕 12 周',
    stageKeys: ['pregnant'],
  },
  {
    key: 'std-pnnt',
    title: 'NT 检查（颈项透明层）',
    description: '孕 11-13⁺⁶ 周完成 NT 超声检查，是早孕期重要的胎儿染色体异常筛查手段。',
    eventType: 'checkup',
    sourceKey: 'prenatal',
    sourceLabel: PRENATAL_SOURCE_LABEL,
    offsetDays: -189, // 280 - 91(13w)
    dateLabel: '孕 11-13⁺⁶ 周',
    stageKeys: ['pregnant'],
  },
  {
    key: 'std-pn16',
    title: '唐氏筛查',
    description: '孕 15-20 周建议完成中孕期血清学筛查（唐筛），评估胎儿 21/18/13 三体风险。',
    eventType: 'checkup',
    sourceKey: 'prenatal',
    sourceLabel: PRENATAL_SOURCE_LABEL,
    offsetDays: -168, // 280 - 112(16w)
    dateLabel: '孕 15-20 周',
    stageKeys: ['pregnant'],
  },
  {
    key: 'std-pn20',
    title: '系统超声（大排畸）',
    description: '孕 20-24 周完成胎儿系统超声检查，重点排查结构畸形。',
    eventType: 'checkup',
    sourceKey: 'prenatal',
    sourceLabel: PRENATAL_SOURCE_LABEL,
    offsetDays: -140, // 280 - 140(20w)
    dateLabel: '孕 20-24 周',
    stageKeys: ['pregnant'],
  },
  {
    key: 'std-pn24',
    title: '糖耐量检查（OGTT）',
    description: '孕 24-28 周进行 75g 口服葡萄糖耐量试验，筛查妊娠期糖尿病。',
    eventType: 'checkup',
    sourceKey: 'prenatal',
    sourceLabel: PRENATAL_SOURCE_LABEL,
    offsetDays: -112, // 280 - 168(24w)
    dateLabel: '孕 24-28 周',
    stageKeys: ['pregnant'],
  },
  {
    key: 'std-pn28',
    title: '孕 28 周产检',
    description: '进入孕晚期，产检频率建议提高到每两周一次，检查血压、宫高、胎心、血常规等。',
    eventType: 'checkup',
    sourceKey: 'prenatal',
    sourceLabel: PRENATAL_SOURCE_LABEL,
    offsetDays: -84, // 280 - 196(28w)
    dateLabel: '孕 28 周',
    stageKeys: ['pregnant'],
  },
  {
    key: 'std-pn30',
    title: '孕 30 周产检',
    description: '继续监测血压、宫高腹围、胎位和胎心。',
    eventType: 'checkup',
    sourceKey: 'prenatal',
    sourceLabel: PRENATAL_SOURCE_LABEL,
    offsetDays: -70, // 280 - 210(30w)
    dateLabel: '孕 30 周',
    stageKeys: ['pregnant'],
  },
  {
    key: 'std-pn32',
    title: '孕 32 周产检 + 超声',
    description: '孕 32 周左右建议复查超声评估胎儿生长和羊水量，核实胎位。',
    eventType: 'checkup',
    sourceKey: 'prenatal',
    sourceLabel: PRENATAL_SOURCE_LABEL,
    offsetDays: -56, // 280 - 224(32w)
    dateLabel: '孕 32 周',
    stageKeys: ['pregnant'],
  },
  {
    key: 'std-pn34',
    title: '孕 34 周产检',
    description: '重点监测血压、水肿和胎动，评估是否需要额外检查。',
    eventType: 'checkup',
    sourceKey: 'prenatal',
    sourceLabel: PRENATAL_SOURCE_LABEL,
    offsetDays: -42, // 280 - 238(34w)
    dateLabel: '孕 34 周',
    stageKeys: ['pregnant'],
  },
  {
    key: 'std-pn36',
    title: '孕 36 周产检 + GBS',
    description: '孕 35-37 周建议完成 B 族链球菌（GBS）筛查，同时评估分娩方式。产检频率建议每周一次。',
    eventType: 'checkup',
    sourceKey: 'prenatal',
    sourceLabel: PRENATAL_SOURCE_LABEL,
    offsetDays: -28, // 280 - 252(36w)
    dateLabel: '孕 36 周',
    stageKeys: ['pregnant'],
  },
  {
    key: 'std-pn37',
    title: '孕 37 周产检（足月）',
    description: '进入足月期，每周产检关注胎心监护、胎位、宫颈成熟度和入院准备。',
    eventType: 'checkup',
    sourceKey: 'prenatal',
    sourceLabel: PRENATAL_SOURCE_LABEL,
    offsetDays: -21, // 280 - 259(37w)
    dateLabel: '孕 37 周',
    stageKeys: ['pregnant'],
  },
  {
    key: 'std-pn38',
    title: '孕 38 周产检',
    description: '继续每周胎心监护，关注宫缩和入院时机。',
    eventType: 'checkup',
    sourceKey: 'prenatal',
    sourceLabel: PRENATAL_SOURCE_LABEL,
    offsetDays: -14, // 280 - 266(38w)
    dateLabel: '孕 38 周',
    stageKeys: ['pregnant'],
  },
  {
    key: 'std-pn39',
    title: '孕 39 周产检',
    description: '评估是否需要引产或继续等待自然发动，复核入院清单。',
    eventType: 'checkup',
    sourceKey: 'prenatal',
    sourceLabel: PRENATAL_SOURCE_LABEL,
    offsetDays: -7, // 280 - 273(39w)
    dateLabel: '孕 39 周',
    stageKeys: ['pregnant'],
  },
  {
    key: 'std-pnedd',
    title: '预产期',
    description: '预产期当天如未发动，建议与产科医生确认后续监测方案和是否计划引产。',
    eventType: 'reminder',
    sourceKey: 'prenatal',
    sourceLabel: PRENATAL_SOURCE_LABEL,
    offsetDays: 0,
    dateLabel: '预产期',
    stageKeys: ['pregnant'],
  },
];

const STANDARD_SCHEDULE_DEFINITIONS: StandardScheduleDefinition[] = [
  ...PRENATAL_SCHEDULE_DEFINITIONS,
  {
    key: 'std-pp03',
    title: '产后首次访视',
    description: '建议在产后 3-7 天内完成访视，重点关注恶露、伤口、血压、乳房和喂养情况。',
    eventType: 'checkup',
    sourceKey: 'postpartum',
    sourceLabel: POSTPARTUM_SOURCE_LABEL,
    offsetDays: 3,
    dateLabel: '产后第 3 天起',
    stageKeys: ['postpartum_newborn', 'postpartum_recovery'],
  },
  {
    key: 'std-pp28',
    title: '产后 28 天访视',
    description: '进入产后 28 天节点后，继续复盘恢复、情绪、睡眠和喂养节奏。',
    eventType: 'checkup',
    sourceKey: 'postpartum',
    sourceLabel: POSTPARTUM_SOURCE_LABEL,
    offsetDays: 28,
    dateLabel: '产后第 28 天',
    stageKeys: ['postpartum_newborn', 'postpartum_recovery'],
  },
  {
    key: 'std-pp42',
    title: '产后 42 天复查',
    description: '把产后 42 天复查提前排进日历，集中核对伤口恢复、盆底、恶露和避孕计划。',
    eventType: 'checkup',
    sourceKey: 'postpartum',
    sourceLabel: POSTPARTUM_SOURCE_LABEL,
    offsetDays: 42,
    dateLabel: '产后第 42 天',
    stageKeys: ['postpartum_newborn', 'postpartum_recovery'],
  },
  {
    key: 'std-hc07',
    title: '新生儿家庭访视',
    description: '建议在出生后 1 周内完成家庭访视，重点看黄疸、喂养、体温、脐带和体重变化。',
    eventType: 'checkup',
    sourceKey: 'checkup',
    sourceLabel: CHILD_CHECK_SOURCE_LABEL,
    offsetDays: 7,
    dateLabel: '出生后 1 周',
    stageKeys: ['postpartum_newborn', 'postpartum_recovery', 'infant_0_6'],
  },
  {
    key: 'std-hc1m',
    title: '满月健康检查',
    description: '满月时建议完成一次系统检查，核对喂养、体重、黄疸回落和发育基础情况。',
    eventType: 'checkup',
    sourceKey: 'checkup',
    sourceLabel: CHILD_CHECK_SOURCE_LABEL,
    offsetMonths: 1,
    dateLabel: '满 1 月',
    stageKeys: ['postpartum_newborn', 'postpartum_recovery', 'infant_0_6'],
  },
  {
    key: 'std-hc3m',
    title: '3 月龄健康检查',
    description: '重点看体格生长、抬头互动、喂养和近期睡眠节奏。',
    eventType: 'checkup',
    sourceKey: 'checkup',
    sourceLabel: CHILD_CHECK_SOURCE_LABEL,
    offsetMonths: 3,
    dateLabel: '满 3 月',
    stageKeys: ['infant_0_6', 'infant_6_12'],
  },
  {
    key: 'std-hc6m',
    title: '6 月龄健康检查',
    description: '核对身高体重、喂养方式、睡眠和添加辅食前后的适应情况。',
    eventType: 'checkup',
    sourceKey: 'checkup',
    sourceLabel: CHILD_CHECK_SOURCE_LABEL,
    offsetMonths: 6,
    dateLabel: '满 6 月',
    stageKeys: ['infant_0_6', 'infant_6_12'],
  },
  {
    key: 'std-hc8m',
    title: '8 月龄健康检查',
    description: '重点看辅食推进、翻爬坐立和亲子互动反应。',
    eventType: 'checkup',
    sourceKey: 'checkup',
    sourceLabel: CHILD_CHECK_SOURCE_LABEL,
    offsetMonths: 8,
    dateLabel: '满 8 月',
    stageKeys: ['infant_6_12', 'toddler_1_3'],
  },
  {
    key: 'std-hc12',
    title: '12 月龄健康检查',
    description: '满周岁时建议完成一次节点体检，结合站立、进食、睡眠和发育里程碑复盘。',
    eventType: 'checkup',
    sourceKey: 'checkup',
    sourceLabel: CHILD_CHECK_SOURCE_LABEL,
    offsetMonths: 12,
    dateLabel: '满 12 月',
    stageKeys: ['infant_6_12', 'toddler_1_3'],
  },
  {
    key: 'std-hc18',
    title: '18 月龄健康检查',
    description: '关注语言起步、步态、喂养和睡眠边界。',
    eventType: 'checkup',
    sourceKey: 'checkup',
    sourceLabel: CHILD_CHECK_SOURCE_LABEL,
    offsetMonths: 18,
    dateLabel: '满 18 月',
    stageKeys: ['toddler_1_3', 'child_3_plus'],
  },
  {
    key: 'std-hc24',
    title: '24 月龄健康检查',
    description: '重点核对语言、如厕、行为和营养情况。',
    eventType: 'checkup',
    sourceKey: 'checkup',
    sourceLabel: CHILD_CHECK_SOURCE_LABEL,
    offsetMonths: 24,
    dateLabel: '满 24 月',
    stageKeys: ['toddler_1_3', 'child_3_plus'],
  },
  {
    key: 'std-hc30',
    title: '30 月龄健康检查',
    description: '复盘语言、社交、作息和家庭规则建立情况。',
    eventType: 'checkup',
    sourceKey: 'checkup',
    sourceLabel: CHILD_CHECK_SOURCE_LABEL,
    offsetMonths: 30,
    dateLabel: '满 30 月',
    stageKeys: ['toddler_1_3', 'child_3_plus'],
  },
  {
    key: 'std-hc36',
    title: '36 月龄健康检查',
    description: '进入 3 岁节点时，重点看语言、社交、专注和行为习惯。',
    eventType: 'checkup',
    sourceKey: 'checkup',
    sourceLabel: CHILD_CHECK_SOURCE_LABEL,
    offsetMonths: 36,
    dateLabel: '满 36 月',
    stageKeys: ['toddler_1_3', 'child_3_plus'],
  },
  {
    key: 'std-hc48',
    title: '4 岁健康检查',
    description: '年度健康检查建议核对视力、听力、牙齿和学前行为适应。',
    eventType: 'checkup',
    sourceKey: 'checkup',
    sourceLabel: CHILD_CHECK_SOURCE_LABEL,
    offsetMonths: 48,
    dateLabel: '满 4 岁',
    stageKeys: ['child_3_plus'],
  },
  {
    key: 'std-hc60',
    title: '5 岁健康检查',
    description: '持续关注体格、牙齿、视力和入园后行为适应。',
    eventType: 'checkup',
    sourceKey: 'checkup',
    sourceLabel: CHILD_CHECK_SOURCE_LABEL,
    offsetMonths: 60,
    dateLabel: '满 5 岁',
    stageKeys: ['child_3_plus'],
  },
  {
    key: 'std-hc72',
    title: '6 岁健康检查',
    description: '入学前建议完成节点体检，统一回看视力、听力、牙齿和行为习惯。',
    eventType: 'checkup',
    sourceKey: 'checkup',
    sourceLabel: CHILD_CHECK_SOURCE_LABEL,
    offsetMonths: 72,
    dateLabel: '满 6 岁',
    stageKeys: ['child_3_plus'],
  },
  {
    key: 'std-vbth',
    title: '出生接种核对',
    description: '出生后尽快与接种门诊核对乙肝第 1 剂和卡介苗安排。',
    eventType: 'vaccine',
    sourceKey: 'vaccine',
    sourceLabel: VACCINE_SOURCE_LABEL,
    offsetDays: 0,
    dateLabel: '出生当日',
    stageKeys: ['postpartum_newborn', 'postpartum_recovery', 'infant_0_6'],
  },
  {
    key: 'std-v1m',
    title: '1 月龄接种核对',
    description: '满 1 月时与接种门诊核对乙肝第 2 剂安排。',
    eventType: 'vaccine',
    sourceKey: 'vaccine',
    sourceLabel: VACCINE_SOURCE_LABEL,
    offsetMonths: 1,
    dateLabel: '满 1 月',
    stageKeys: ['postpartum_newborn', 'postpartum_recovery', 'infant_0_6'],
  },
  {
    key: 'std-v2m',
    title: '2 月龄接种核对',
    description: '满 2 月时核对脊灰灭活疫苗第 1 剂接种安排。',
    eventType: 'vaccine',
    sourceKey: 'vaccine',
    sourceLabel: VACCINE_SOURCE_LABEL,
    offsetMonths: 2,
    dateLabel: '满 2 月',
    stageKeys: ['infant_0_6'],
  },
  {
    key: 'std-v3m',
    title: '3 月龄接种核对',
    description: '满 3 月时与接种门诊核对脊灰灭活第 2 剂和百白破第 1 剂。',
    eventType: 'vaccine',
    sourceKey: 'vaccine',
    sourceLabel: VACCINE_SOURCE_LABEL,
    offsetMonths: 3,
    dateLabel: '满 3 月',
    stageKeys: ['infant_0_6', 'infant_6_12'],
  },
  {
    key: 'std-v4m',
    title: '4 月龄接种核对',
    description: '满 4 月时核对脊灰和百白破后续接种安排。',
    eventType: 'vaccine',
    sourceKey: 'vaccine',
    sourceLabel: VACCINE_SOURCE_LABEL,
    offsetMonths: 4,
    dateLabel: '满 4 月',
    stageKeys: ['infant_0_6', 'infant_6_12'],
  },
  {
    key: 'std-v5m',
    title: '5 月龄接种核对',
    description: '满 5 月时核对百白破第 3 剂是否已排期。',
    eventType: 'vaccine',
    sourceKey: 'vaccine',
    sourceLabel: VACCINE_SOURCE_LABEL,
    offsetMonths: 5,
    dateLabel: '满 5 月',
    stageKeys: ['infant_0_6', 'infant_6_12'],
  },
  {
    key: 'std-v6m',
    title: '6 月龄接种核对',
    description: '满 6 月时与接种门诊核对乙肝第 3 剂及流脑程序。',
    eventType: 'vaccine',
    sourceKey: 'vaccine',
    sourceLabel: VACCINE_SOURCE_LABEL,
    offsetMonths: 6,
    dateLabel: '满 6 月',
    stageKeys: ['infant_0_6', 'infant_6_12'],
  },
  {
    key: 'std-v8m',
    title: '8 月龄接种核对',
    description: '满 8 月时核对麻腮风第 1 剂和乙脑程序安排。',
    eventType: 'vaccine',
    sourceKey: 'vaccine',
    sourceLabel: VACCINE_SOURCE_LABEL,
    offsetMonths: 8,
    dateLabel: '满 8 月',
    stageKeys: ['infant_6_12', 'toddler_1_3'],
  },
  {
    key: 'std-v9m',
    title: '9 月龄接种核对',
    description: '满 9 月时与接种门诊核对流脑后续剂次安排。',
    eventType: 'vaccine',
    sourceKey: 'vaccine',
    sourceLabel: VACCINE_SOURCE_LABEL,
    offsetMonths: 9,
    dateLabel: '满 9 月',
    stageKeys: ['infant_6_12', 'toddler_1_3'],
  },
  {
    key: 'std-v18m',
    title: '18 月龄接种核对',
    description: '满 18 月时建议集中核对百白破加强、麻腮风第 2 剂及甲肝程序。',
    eventType: 'vaccine',
    sourceKey: 'vaccine',
    sourceLabel: VACCINE_SOURCE_LABEL,
    offsetMonths: 18,
    dateLabel: '满 18 月',
    stageKeys: ['toddler_1_3', 'child_3_plus'],
  },
  {
    key: 'std-v24m',
    title: '24 月龄疫苗记录核对',
    description: '满 24 月时复核甲肝、乙脑等程序是否已按门诊要求完成。',
    eventType: 'vaccine',
    sourceKey: 'vaccine',
    sourceLabel: VACCINE_SOURCE_LABEL,
    offsetMonths: 24,
    dateLabel: '满 24 月',
    stageKeys: ['toddler_1_3', 'child_3_plus'],
  },
  {
    key: 'std-v36m',
    title: '3 岁疫苗记录核对',
    description: '3 岁节点建议统一核对流脑等后续程序和接种本记录。',
    eventType: 'vaccine',
    sourceKey: 'vaccine',
    sourceLabel: VACCINE_SOURCE_LABEL,
    offsetMonths: 36,
    dateLabel: '满 3 岁',
    stageKeys: ['toddler_1_3', 'child_3_plus'],
  },
  {
    key: 'std-v48m',
    title: '4 岁疫苗记录核对',
    description: '4 岁节点建议核对脊灰加强等程序是否已完成。',
    eventType: 'vaccine',
    sourceKey: 'vaccine',
    sourceLabel: VACCINE_SOURCE_LABEL,
    offsetMonths: 48,
    dateLabel: '满 4 岁',
    stageKeys: ['child_3_plus'],
  },
  {
    key: 'std-v72m',
    title: '6 岁疫苗记录核对',
    description: '入学前建议统一核对白破、流脑及本地门诊要求的查验节点。',
    eventType: 'vaccine',
    sourceKey: 'vaccine',
    sourceLabel: VACCINE_SOURCE_LABEL,
    offsetMonths: 72,
    dateLabel: '满 6 岁',
    stageKeys: ['child_3_plus'],
  },
];

function getStatusLabel(status: StandardScheduleItem['status']) {
  switch (status) {
    case 'completed':
      return '已完成';
    case 'scheduled':
      return '已生成';
    case 'due':
      return '今天处理';
    case 'overdue':
      return '已过期';
    default:
      return '待加入';
  }
}

function toEventDate(anchorDate: Date, definition: StandardScheduleDefinition) {
  let target = dayjs(anchorDate).startOf('day');

  if (typeof definition.offsetDays === 'number') {
    target = target.add(definition.offsetDays, 'day');
  }

  if (typeof definition.offsetMonths === 'number') {
    target = target.add(definition.offsetMonths, 'month');
  }

  return target.toDate();
}

function resolveDetailedLifecycleKey(user: UserLifecycleProfile, now = new Date()): SupportedLifecycleKey {
  const lifecycle = resolveLifecycleStage(user.pregnancyStatus, user.dueDate || null, user.babyBirthday || null);
  if (lifecycle === 'preparing') return 'preparing';
  if (lifecycle === 'pregnant') return 'pregnant';

  if (!user.babyBirthday) {
    return 'postpartum_recovery';
  }

  const birthday = dayjs(user.babyBirthday).startOf('day');
  const today = dayjs(now).startOf('day');
  const ageDays = Math.max(today.diff(birthday, 'day'), 0);
  const ageMonths = Math.max(today.diff(birthday, 'month'), 0);

  if (ageDays <= 28) return 'postpartum_newborn';
  if (ageDays <= 42) return 'postpartum_recovery';
  if (ageMonths < 6) return 'infant_0_6';
  if (ageMonths < 12) return 'infant_6_12';
  if (ageMonths < 36) return 'toddler_1_3';
  return 'child_3_plus';
}

function getLifecycleCopy(lifecycleKey: SupportedLifecycleKey): Pick<StandardSchedulePlan, 'title' | 'subtitle' | 'summary'> {
  switch (lifecycleKey) {
    case 'postpartum_newborn':
      return {
        title: '母婴标准节点',
        subtitle: '把产后访视、新生儿访视和出生后关键接种节点一次排进日历。',
        summary: '当前阶段建议优先固化产后恢复和新生儿前 1 个月的标准节点。',
      };
    case 'postpartum_recovery':
      return {
        title: '产后恢复标准节点',
        subtitle: '当前重点是把 42 天内的恢复访视和满月节点固定下来。',
        summary: '系统会优先补齐产后访视、42 天复查和满月健康检查。',
      };
    case 'infant_0_6':
      return {
        title: '0-6 月标准节点',
        subtitle: '把 0-6 月儿保和国家免疫规划关键节点收成一张时间表。',
        summary: '系统会优先补齐出生后到 6 月龄的儿保和接种核对节点。',
      };
    case 'infant_6_12':
      return {
        title: '6-12 月标准节点',
        subtitle: '当前阶段重点是 8 月龄、12 月龄儿保和后续接种核对。',
        summary: '系统会优先补齐 6-12 月内应跟进的儿保与接种节点。',
      };
    case 'toddler_1_3':
      return {
        title: '1-3 岁标准节点',
        subtitle: '把 18、24、30、36 月龄儿保和接种核对固定下来。',
        summary: '当前阶段建议先把 1-3 岁关键体检和接种记录核对安排好。',
      };
    case 'child_3_plus':
      return {
        title: '学龄前标准节点',
        subtitle: '把 4-6 岁年度健康检查和入学前接种查验串成长期时间线。',
        summary: '系统会优先补齐学龄前年度体检与入学前接种核对节点。',
      };
    case 'pregnant':
      return {
        title: '孕期产检标准节点',
        subtitle: '按国家孕产妇健康管理规范，把建档到预产期的关键产检一次排进日历。',
        summary: '系统会根据预产期自动计算每次产检的建议时间，包括 NT、唐筛、大排畸、糖耐等关键检查。',
      };
    default:
      return {
        title: '标准节点待启用',
        subtitle: '当前阶段还没有可自动生成的标准节点。',
        summary: '补充宝宝生日后，系统会自动切换到对应的标准节点时间表。',
      };
  }
}

function buildPlanItems(params: {
  lifecycleKey: SupportedLifecycleKey;
  babyBirthday?: Date | null;
  dueDate?: Date | null;
  existingEvents: ExistingStandardEvent[];
  now?: Date;
}): StandardSchedulePreviewItem[] {
  const isPrenatal = params.lifecycleKey === 'pregnant';
  const anchorDate = isPrenatal ? params.dueDate : params.babyBirthday;

  if (!anchorDate) {
    return [];
  }

  const today = dayjs(params.now || new Date()).startOf('day');
  const existingMap = new Map(
    params.existingEvents.map((item) => [item.reminderType || '', item]),
  );

  return STANDARD_SCHEDULE_DEFINITIONS
    .filter((item) => item.stageKeys.includes(params.lifecycleKey))
    .map((item) => {
      const eventDate = toEventDate(anchorDate as Date, item);
      const dateText = dayjs(eventDate).format('YYYY-MM-DD');
      const existingEvent = existingMap.get(item.key);
      let status: StandardScheduleItem['status'] = 'upcoming';

      if (existingEvent) {
        status = existingEvent.status === 1 ? 'completed' : 'scheduled';
      } else if (dayjs(eventDate).isSame(today, 'day')) {
        status = 'due';
      } else if (dayjs(eventDate).isBefore(today, 'day')) {
        status = 'overdue';
      }

      return {
        key: item.key,
        title: item.title,
        description: item.description,
        eventType: item.eventType,
        eventDate: dateText,
        dateLabel: item.dateLabel,
        sourceLabel: item.sourceLabel,
        status,
        statusLabel: getStatusLabel(status),
        isGenerated: Boolean(existingEvent),
        eventId: existingEvent ? Number(existingEvent.id) : undefined,
      };
    })
    .sort((left, right) => left.eventDate.localeCompare(right.eventDate));
}

export function buildStandardSchedulePlan(params: {
  user: UserLifecycleProfile;
  existingEvents?: ExistingStandardEvent[];
  now?: Date;
}): StandardSchedulePlan {
  const lifecycleKey = resolveDetailedLifecycleKey(params.user, params.now);
  const lifecycleCopy = getLifecycleCopy(lifecycleKey);
  const dueDate = params.user.dueDate || null;
  // Current auto-generation only writes child/postpartum nodes, so keep
  // prenatal plans unavailable until due-date generation is fully wired.
  const supportsAutoGeneration = lifecycleKey !== 'pregnant';
  const babyBirthday = params.user.babyBirthday || null;
  const hasAnchor = supportsAutoGeneration ? Boolean(babyBirthday) : false;

  if (!hasAnchor || lifecycleKey === 'preparing') {
    return {
      available: false,
      lifecycleKey,
      title: lifecycleCopy.title,
      subtitle: lifecycleCopy.subtitle,
      summary: lifecycleCopy.summary,
      generatedCount: 0,
      pendingCount: 0,
      items: [],
    };
  }

  const items = buildPlanItems({
    lifecycleKey,
    babyBirthday,
    dueDate,
    existingEvents: params.existingEvents || [],
    now: params.now,
  });

  return {
    available: items.length > 0,
    lifecycleKey,
    title: lifecycleCopy.title,
    subtitle: lifecycleCopy.subtitle,
    summary: lifecycleCopy.summary,
    generatedCount: items.filter((item) => item.isGenerated).length,
    pendingCount: items.filter((item) => !item.isGenerated).length,
    items,
  };
}

export function getMissingStandardScheduleDefinitions(plan: StandardSchedulePlan) {
  const missingKeys = new Set(plan.items.filter((item) => !item.isGenerated).map((item) => item.key));
  return STANDARD_SCHEDULE_DEFINITIONS.filter((item) => missingKeys.has(item.key));
}

export function buildStandardScheduleEventPayload(anchorDate: Date, definition: StandardScheduleDefinition) {
  const eventDate = toEventDate(anchorDate, definition);

  return {
    title: definition.title,
    description: `${definition.description}（来源：${definition.sourceLabel}）`,
    eventType: definition.eventType,
    eventDate,
    reminderMinutes: STANDARD_REMINDER_MINUTES,
    reminderType: definition.key,
  };
}
