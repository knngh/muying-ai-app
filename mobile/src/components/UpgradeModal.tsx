import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Button, Card, Modal, Portal, Text } from 'react-native-paper'
import { colors, fontSize, spacing } from '../theme'
import type { MembershipPlan } from '../stores/membershipStore'

type UpgradeModalProps = {
  visible: boolean
  plans: MembershipPlan[]
  loading?: boolean
  onDismiss: () => void
  onUpgrade: (code: MembershipPlan['code']) => void
  onViewMembership: () => void
}

export default function UpgradeModal({
  visible,
  plans,
  loading = false,
  onDismiss,
  onUpgrade,
  onViewMembership,
}: UpgradeModalProps) {
  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.modalContainer}>
        <Text style={styles.modalTitle}>今日免费额度已用完</Text>
        <Text style={styles.modalSubtitle}>
          开通会员后可继续追问，且支持 AI 周报、专属内容和成长档案增强。
        </Text>

        {plans.map((plan) => (
          <Card key={plan.code} style={styles.planCard}>
            <Card.Content style={styles.planContent}>
              <View>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planDesc}>{plan.monthlyPriceLabel}</Text>
              </View>
              <Button
                mode="contained"
                buttonColor={colors.ink}
                loading={loading}
                disabled={loading}
                onPress={() => onUpgrade(plan.code)}
              >
                ¥{plan.price}
              </Button>
            </Card.Content>
          </Card>
        ))}

        <Button mode="text" onPress={onViewMembership}>
          查看完整权益说明
        </Button>
      </Modal>
    </Portal>
  )
}

const styles = StyleSheet.create({
  modalContainer: {
    margin: spacing.md,
    borderRadius: 24,
    padding: spacing.lg,
    backgroundColor: colors.white,
  },
  modalTitle: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text,
  },
  modalSubtitle: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    color: colors.textLight,
    lineHeight: 22,
  },
  planCard: {
    marginBottom: spacing.sm,
    borderRadius: 18,
    backgroundColor: colors.background,
  },
  planContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  planName: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  planDesc: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
  },
})
