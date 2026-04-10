export const colors = {
  primary: '#C56C47',
  primaryLight: '#F6E1D4',
  primaryDark: '#9F4E2E',
  copper: '#B96842',
  copperSoft: '#F3D6C4',
  pink: '#D9907A',
  pinkLight: '#FCEBE2',
  green: '#9EAB84',
  greenLight: '#EEF1E5',
  orange: '#E3B076',
  orangeLight: '#FFF1DF',
  tech: '#5E7E86',
  techDark: '#355862',
  techLight: '#DCECEE',
  purple: '#C8A99B',
  purpleLight: '#F5ECE7',
  gold: '#B88A48',
  goldLight: '#F7EEDC',
  ink: '#3F2A22',
  inkSoft: '#70554A',
  inkDeep: '#241813',
  red: '#D47B61',
  redLight: '#F8E5DD',
  text: '#35261E',
  textSecondary: '#826C60',
  textLight: '#B29E92',
  border: '#E8D7CB',
  background: '#F6EEE6',
  backgroundDeep: '#F0E2D4',
  backgroundSoft: '#FFF8F2',
  white: '#FFFDF9',
  surface: '#F4E8DC',
  surfaceRaised: '#FFF9F4',
  surfaceMuted: '#F1E4D7',
  surfaceGlass: 'rgba(255, 249, 244, 0.82)',
  accent: '#D98A5D',
  accentLight: '#F8E6D5',
  successSoft: '#EAF0E2',
  trustChipBg: '#f3ebe2',
  trustSummaryBg: '#fff8f0',
  uncertaintyBg: '#fff3df',
  uncertaintyTitle: '#9a5b12',
  uncertaintyText: '#8a6528',
  divider: 'rgba(63,42,34,0.08)',
  shadowStrong: 'rgba(63,42,34,0.18)',
  shadowSoft: 'rgba(63,42,34,0.08)',
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
