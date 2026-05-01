export const colors = {
  primary: '#C66A4A',
  primaryLight: '#F8E2D6',
  primaryDark: '#984B2F',
  copper: '#A96545',
  copperSoft: '#F1D8C8',
  pink: '#D57A8B',
  pinkLight: '#FBE5EA',
  green: '#6F8F72',
  greenLight: '#EAF1E7',
  orange: '#D99A54',
  orangeLight: '#FFF0DC',
  tech: '#4F8390',
  techDark: '#2F5E68',
  techLight: '#E3F0F2',
  purple: '#8E7AA8',
  purpleLight: '#EEE8F6',
  gold: '#AA7B38',
  goldLight: '#F4E8CE',
  ink: '#27313D',
  inkSoft: '#5F6D7C',
  inkDeep: '#151D26',
  red: '#C95B55',
  redLight: '#F9E1DE',
  text: '#26313D',
  textSecondary: '#667486',
  textLight: '#9AA6B2',
  border: '#DDE6EA',
  background: '#F3F6F8',
  backgroundDeep: '#E7EEF2',
  backgroundSoft: '#FAFCFD',
  white: '#FFFFFF',
  surface: '#EEF4F6',
  surfaceRaised: '#FFFFFF',
  surfaceMuted: '#EAF0F3',
  surfaceGlass: 'rgba(255, 255, 255, 0.9)',
  accent: '#D98A5D',
  accentLight: '#F8E6D5',
  successSoft: '#EAF0E2',
  trustChipBg: '#EEF5F2',
  trustSummaryBg: '#FAFCFD',
  uncertaintyBg: '#FFF4E4',
  uncertaintyTitle: '#8A5A16',
  uncertaintyText: '#755F2E',
  divider: 'rgba(38,49,61,0.08)',
  shadowStrong: 'rgba(38,49,61,0.14)',
  shadowSoft: 'rgba(38,49,61,0.08)',
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
  md: 12,
  lg: 16,
  xl: 20,
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
