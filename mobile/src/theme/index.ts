export const colors = {
  primary: '#FF8A8A', // Soft Peach / Warm Coral
  primaryLight: '#FFEFEF',
  primaryDark: '#FF6B6B',
  pink: '#FFB6C1',
  pinkLight: '#FFF0F5',
  green: '#A8E6CF', // Sage / Mint Green
  greenLight: '#E8F8F5',
  orange: '#FFD3B6',
  orangeLight: '#FFF5EB',
  purple: '#DCD0FF',
  purpleLight: '#F4F0FF',
  gold: '#FFDFBA',
  goldLight: '#FFF9F0',
  ink: '#4A4A4A', // Softer dark grey/brown
  inkSoft: '#6B605A',
  red: '#FF9AA2',
  redLight: '#FFEFEF',
  text: '#4A4A4A',
  textSecondary: '#8C8C8C',
  textLight: '#B0B0B0',
  border: '#EFEFEF', // Softer border
  background: '#FAFAFA', // Soft off-white cream
  white: '#ffffff',
  trustChipBg: '#f3efe9',
  trustSummaryBg: '#fffaf4',
  uncertaintyBg: '#fff7e8',
  uncertaintyTitle: '#ad6800',
  uncertaintyText: '#8c6a00',
  divider: 'rgba(0,0,0,0.05)',
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 48,
}

export const fontSize = {
  xs: 11,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  title: 24,
  heroTitle: 26,
}

export const borderRadius = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 9999,
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
