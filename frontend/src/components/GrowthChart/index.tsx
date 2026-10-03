import { useMemo } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { referenceSeries, valueAtPercentile } from '@/data/who-growth-standards'
import type { ChartSex, GrowthMetric } from '@/data/who-growth-standards'
import styles from './GrowthChart.module.css'

export interface GrowthChartPoint {
  monthAge: number
  value: number
  date: string
}

interface GrowthChartProps {
  metric: GrowthMetric
  sex: ChartSex | null
  points: GrowthChartPoint[]
  unit: string
}

interface ChartDatum {
  monthAge: number
  value?: number
  date?: string
  p3?: number
  p50?: number
  p97?: number
}

interface TooltipEntry {
  payload: ChartDatum
}

const X_TICKS = [0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60]

function formatMonthAge(monthAge: number): string {
  return `${Math.round(monthAge * 10) / 10}`
}

function ChartTooltip({ active, payload, unit }: { active?: boolean; payload?: TooltipEntry[]; unit: string }) {
  if (!active || !payload || payload.length === 0) return null
  const datum = payload[0].payload
  if (!datum) return null
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipTitle}>
        {datum.date ? `${datum.date}（月龄 ${formatMonthAge(datum.monthAge)} 个月）` : `月龄 ${formatMonthAge(datum.monthAge)} 个月`}
      </div>
      {datum.value !== undefined ? (
        <div className={styles.tooltipRow}>
          测量值 <span className={styles.tooltipValue}>{datum.value} {unit}</span>
        </div>
      ) : null}
      {datum.p50 !== undefined ? (
        <div className={styles.tooltipRow}>WHO 中位数 {datum.p50} {unit}</div>
      ) : null}
    </div>
  )
}

export function GrowthChart({ metric, sex, points, unit }: GrowthChartProps) {
  // 合并 WHO 参考 61 点与用户点；用户点同时补插值参考值，保证参考带在非整数月龄处不断开
  const chartData = useMemo<ChartDatum[]>(() => {
    if (!sex) {
      return points
        .map((point) => ({ ...point }))
        .sort((a, b) => a.monthAge - b.monthAge)
    }
    const p3 = referenceSeries(metric, sex, 3)
    const p50 = referenceSeries(metric, sex, 50)
    const p97 = referenceSeries(metric, sex, 97)
    const referenceRows: ChartDatum[] = p3.map((row, index) => ({
      monthAge: row.monthAge,
      p3: row.value,
      p50: p50[index].value,
      p97: p97[index].value,
    }))
    const userRows: ChartDatum[] = points.map((point) => ({
      ...point,
      p3: valueAtPercentile(metric, sex, point.monthAge, 3) ?? undefined,
      p50: valueAtPercentile(metric, sex, point.monthAge, 50) ?? undefined,
      p97: valueAtPercentile(metric, sex, point.monthAge, 97) ?? undefined,
    }))
    return [...referenceRows, ...userRows].sort((a, b) => a.monthAge - b.monthAge)
  }, [metric, points, sex])

  // 参考带存在时，Y 域以参考带范围为基础合并用户数据
  const yDomain = useMemo<[number | 'auto', number | 'auto']>(() => {
    const values: number[] = points.map((point) => point.value)
    if (sex) {
      for (let month = 0; month <= 60; month += 1) {
        const low = valueAtPercentile(metric, sex, month, 3)
        const high = valueAtPercentile(metric, sex, month, 97)
        if (low !== null) values.push(low)
        if (high !== null) values.push(high)
      }
    }
    if (values.length === 0) return ['auto', 'auto']
    const min = Math.min(...values)
    const max = Math.max(...values)
    const pad = (max - min) * 0.06 || 1
    return [Math.floor((min - pad) * 10) / 10, Math.ceil((max + pad) * 10) / 10]
  }, [metric, points, sex])

  return (
    <div className={styles.wrapper}>
      <div className={styles.chart}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 12, right: 18, bottom: 16, left: 0 }}>
            <defs>
              <linearGradient id="whoBandFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(197, 92, 66, 0.14)" />
                <stop offset="100%" stopColor="rgba(197, 92, 66, 0.08)" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(154, 112, 82, 0.12)" strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey="monthAge"
              type="number"
              domain={sex ? [0, 60] : ['auto', 'auto']}
              ticks={sex ? X_TICKS : undefined}
              tickFormatter={(value: number) => `${value}`}
              tick={{ fill: '#8a766d', fontSize: 12 }}
              axisLine={{ stroke: 'rgba(154, 112, 82, 0.2)' }}
              tickLine={false}
              label={{ value: '月龄', position: 'insideBottomRight', offset: -6, fill: '#8a766d', fontSize: 12 }}
            />
            <YAxis
              domain={yDomain}
              width={46}
              tick={{ fill: '#8a766d', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              label={{ value: unit, angle: -90, position: 'insideLeft', fill: '#8a766d', fontSize: 12 }}
            />
            {sex ? (
              <Area
                type="monotone"
                dataKey={(datum: ChartDatum) => [datum.p3, datum.p97]}
                stroke="none"
                fill="url(#whoBandFill)"
                dot={false}
                activeDot={false}
                connectNulls
                isAnimationActive={false}
              />
            ) : null}
            {sex ? (
              <Line
                type="monotone"
                dataKey="p3"
                stroke="rgba(197, 92, 66, 0.35)"
                strokeWidth={1}
                dot={false}
                activeDot={false}
                connectNulls
                isAnimationActive={false}
              />
            ) : null}
            {sex ? (
              <Line
                type="monotone"
                dataKey="p97"
                stroke="rgba(197, 92, 66, 0.35)"
                strokeWidth={1}
                dot={false}
                activeDot={false}
                connectNulls
                isAnimationActive={false}
              />
            ) : null}
            {sex ? (
              <Line
                type="monotone"
                dataKey="p50"
                stroke="#c9a899"
                strokeWidth={1.5}
                strokeDasharray="7 6"
                dot={false}
                activeDot={false}
                connectNulls
                isAnimationActive={false}
              />
            ) : null}
            <Line
              type="monotone"
              dataKey="value"
              stroke="#c55c42"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#c55c42', stroke: '#fff', strokeWidth: 1.5 }}
              activeDot={{ r: 5, fill: '#c55c42', stroke: '#fff', strokeWidth: 1.5 }}
              connectNulls
              isAnimationActive={false}
            />
            <Tooltip
              content={<ChartTooltip unit={unit} />}
              cursor={{ stroke: 'rgba(197, 92, 66, 0.35)', strokeDasharray: '4 4' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {sex ? (
        <p className={styles.note}>参考带为 WHO 生长标准（0-2 岁为卧位身长，2 岁起为立位身高）</p>
      ) : null}
    </div>
  )
}
