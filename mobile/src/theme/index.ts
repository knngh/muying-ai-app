export const colors = {
  primary: '#1890ff',
  primaryLight: '#e6f7ff',
  pink: '#eb2f96',
  pinkLight: '#fff0f6',
  green: '#52c41a',
  greenLight: '#f6ffed',
  orange: '#fa8c16',
  orangeLight: '#fff7e6',
  purple: '#722ed1',
  purpleLight: '#f9f0ff',
  red: '#ff4d4f',
  redLight: '#fff1f0',
  text: '#333333',
  textSecondary: '#999999',
  textLight: '#666666',
  border: '#f0f0f0',
  background: '#f5f5f5',
  white: '#ffffff',
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
}

export const fontSize = {
  xs: 11,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  title: 24,
}

export const eventTypeColors: Record<string, string> = {
  checkup: colors.orange,
  vaccine: colors.green,
  reminder: colors.primary,
  other: colors.textSecondary,
}

export const eventTypeLabels: Record<string, string> = {
  checkup: '产检',
  vaccine: '疫苗',
  reminder: '提醒',
  exercise: '运动',
  diet: '饮食',
  other: '其他',
}

export const categoryColors: Record<string, string> = {
  '孕期知识': colors.pink,
  '育儿知识': colors.primary,
  '营养健康': colors.green,
  '疫苗接种': colors.orange,
  '常见问题': colors.purple,
}
