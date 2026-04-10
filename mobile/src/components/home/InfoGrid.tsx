import React from 'react'
import { StyleSheet, View } from 'react-native'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { Card, Text } from 'react-native-paper'
import { StandardCard } from '../layout'
import { borderRadius, colors, fontSize, spacing } from '../../theme'

interface InfoGridProps {
  focusTitle: string
  reminder: string
  todayTip: string
}

export default function InfoGrid({ focusTitle, reminder, todayTip }: InfoGridProps) {
  return (
    <View style={styles.infoGrid}>
      <StandardCard style={styles.infoCard}>
        <Card.Content style={styles.infoContent}>
          <View style={styles.infoHeader}>
            <View style={styles.infoIconShell}>
              <MaterialCommunityIcons name="target" size={16} color={colors.primaryDark} />
            </View>
            <Text style={styles.infoEyebrow}>阶段重点</Text>
          </View>
          <Text style={styles.infoLabel}>{focusTitle}</Text>
          <Text style={styles.infoTitle}>{reminder}</Text>
        </Card.Content>
      </StandardCard>

      <StandardCard style={[styles.infoCard, styles.infoCardAccent]}>
        <Card.Content style={styles.infoContent}>
          <View style={styles.infoHeader}>
            <View style={[styles.infoIconShell, styles.infoIconShellAccent]}>
              <MaterialCommunityIcons name="robot-outline" size={16} color={colors.techDark} />
            </View>
            <Text style={styles.infoEyebrow}>今日建议</Text>
          </View>
          <Text style={styles.infoLabel}>今日建议</Text>
          <Text style={styles.infoTitle}>{todayTip}</Text>
        </Card.Content>
      </StandardCard>
    </View>
  )
}

const styles = StyleSheet.create({
  infoGrid: {
    gap: spacing.md,
  },
  infoCard: {
    backgroundColor: colors.surfaceRaised,
    borderColor: 'rgba(184,138,72,0.12)',
  },
  infoCardAccent: {
    backgroundColor: 'rgba(255, 244, 232, 0.96)',
  },
  infoContent: {
    gap: spacing.xs,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  infoIconShell: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(185,104,66,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIconShellAccent: {
    backgroundColor: 'rgba(94,126,134,0.12)',
  },
  infoEyebrow: {
    color: colors.inkSoft,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  infoLabel: {
    color: colors.inkSoft,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  infoTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 22,
  },
})
