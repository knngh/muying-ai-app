import React from 'react'
import { MD3LightTheme, PaperProvider } from 'react-native-paper'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import AppNavigator from './src/navigation/AppNavigator'
import { colors } from './src/theme'

const appTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    onPrimary: colors.white,
    primaryContainer: colors.primaryLight,
    onPrimaryContainer: colors.ink,
    secondary: colors.gold,
    secondaryContainer: colors.goldLight,
    surface: colors.surfaceRaised,
    surfaceVariant: colors.surface,
    background: colors.background,
    outline: colors.border,
    onSurface: colors.text,
    onSurfaceVariant: colors.textSecondary,
    error: colors.red,
  },
}

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={appTheme}>
        <AppNavigator />
      </PaperProvider>
    </SafeAreaProvider>
  )
}
