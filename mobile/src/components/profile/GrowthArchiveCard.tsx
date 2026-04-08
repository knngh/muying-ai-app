import React from 'react'
import { StyleSheet } from 'react-native'
import { Button, Card, Text } from 'react-native-paper'
import { StandardCard } from '../layout'
import { colors, fontSize, spacing } from '../../theme'

interface GrowthArchiveCardProps {
  status: string
  onPress: () => void
}

export default function GrowthArchiveCard({ status, onPress }: GrowthArchiveCardProps) {
  return (
    <StandardCard>
      <Card.Content>
        <Text style={styles.archiveTitle}>
          把阶段、周报和打卡数据整理成一份可回看的成长档案。
        </Text>
        <Text style={styles.archiveSubtitle}>
          {status === 'active'
            ? '现在可以查看阶段时间轴，并导出一份可分享的档案摘要。'
            : '升级后可查看完整档案、阶段时间轴和分享摘要。'}
        </Text>
        <Button
          mode="contained"
          buttonColor={colors.ink}
          onPress={onPress}
          style={styles.archiveButton}
        >
          {status === 'active' ? '查看成长档案' : '查看档案预览'}
        </Button>
      </Card.Content>
    </StandardCard>
  )
}

const styles = StyleSheet.create({
  archiveTitle: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: colors.text,
    lineHeight: 22,
  },
  archiveSubtitle: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    lineHeight: 20,
    fontSize: fontSize.sm,
  },
  archiveButton: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
  },
})
