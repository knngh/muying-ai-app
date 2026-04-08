import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Card, Text } from 'react-native-paper'
import { StandardCard } from '../layout'
import { colors, fontSize, spacing } from '../../theme'

interface InfoGridProps {
  focusTitle: string
  reminder: string
  todayTip: string
}

export default function InfoGrid({ focusTitle, reminder, todayTip }: InfoGridProps) {
  return (
    <View style={styles.infoGrid}>
      <StandardCard style={styles.infoCard}>
        <Card.Content>
          <Text style={styles.infoLabel}>{focusTitle}</Text>
          <Text style={styles.infoTitle}>{reminder}</Text>
        </Card.Content>
      </StandardCard>

      <StandardCard style={[styles.infoCard, styles.infoCardAccent]}>
        <Card.Content>
          <Text style={styles.infoLabel}>今日建议</Text>
          <Text style={styles.infoTitle}>{todayTip}</Text>
        </Card.Content>
      </StandardCard>
    </View>
  )
}

const styles = StyleSheet.create({
  infoGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  infoCard: {
    flex: 1,
    backgroundColor: colors.white,
  },
  infoCardAccent: {
    backgroundColor: colors.greenLight,
  },
  infoLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
  },
  infoTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 22,
  },
})
