// UUID v4 生成
export function v4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// 日期格式化
export function formatDate(date: Date | string, format = 'YYYY-MM-DD'): string {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds)
}

// 计算孕周
export function calculatePregnancyWeek(lastMenstrualPeriod: Date | string): number {
  const lmp = new Date(lastMenstrualPeriod)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - lmp.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return Math.floor(diffDays / 7)
}

// 计算预产期
export function calculateDueDate(lastMenstrualPeriod: Date | string): Date {
  const lmp = new Date(lastMenstrualPeriod)
  const dueDate = new Date(lmp)
  dueDate.setDate(dueDate.getDate() + 280)
  return dueDate
}
