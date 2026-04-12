import React from 'react'
import { StyleSheet, View } from 'react-native'
import { IconButton, Text, TextInput } from 'react-native-paper'
import { colors, spacing, borderRadius } from '../../theme'

interface ChatInputProps {
  value: string
  onChangeText: (text: string) => void
  onSend: () => void
  loading: boolean
  hint?: string
}

export default function ChatInput({
  value,
  onChangeText,
  onSend,
  loading,
  hint,
}: ChatInputProps) {
  const disabled = !value.trim() || loading

  return (
    <View style={styles.inputWrap}>
      {hint ? (
        <View style={styles.inputHintWrap}>
          <View style={styles.inputHintDot} />
          <Text style={styles.inputHint}>{hint}</Text>
        </View>
      ) : null}

      <View style={styles.dock}>
        <View style={styles.dockGlow} />
        <View style={styles.dockGrid} />
        <View style={styles.dockBeam} />
        <View style={styles.dockBottomLine} />
        <View style={styles.dockHeader}>
          <View style={styles.dockLabelRow}>
            <View style={styles.dockMarker} />
            <Text style={styles.dockEyebrow}>开始提问</Text>
          </View>
          <Text style={styles.dockMeta}>建议一次只问一个具体问题</Text>
        </View>

        <View style={styles.inputRow}>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder="输入你想了解的母婴常见问题"
            placeholderTextColor={colors.textSecondary}
            mode="outlined"
            style={styles.input}
            contentStyle={styles.inputContent}
            outlineColor="rgba(164, 198, 205, 0.22)"
            activeOutlineColor={colors.techDark}
            multiline
            maxLength={2000}
            returnKeyType="send"
            onSubmitEditing={onSend}
            blurOnSubmit={false}
          />
          <IconButton
            icon="send"
            size={20}
            iconColor={colors.white}
            style={[styles.sendButton, disabled && styles.sendButtonDisabled]}
            onPress={onSend}
            disabled={disabled}
          />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  inputWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: 106,
    paddingTop: spacing.sm,
    backgroundColor: 'transparent',
  },
  inputHintWrap: {
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255, 249, 244, 0.76)',
    borderWidth: 1,
    borderColor: 'rgba(207, 223, 227, 0.3)',
  },
  inputHintDot: {
    width: 5,
    height: 5,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(94, 126, 134, 0.55)',
  },
  inputHint: {
    color: colors.inkSoft,
    fontSize: 10,
    lineHeight: 15,
    flex: 1,
  },
  dock: {
    padding: spacing.sm,
    borderRadius: borderRadius.xl,
    backgroundColor: 'rgba(255, 250, 246, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(182, 210, 216, 0.26)',
    shadowColor: colors.inkSoft,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    overflow: 'hidden',
  },
  dockGlow: {
    position: 'absolute',
    top: -26,
    right: -6,
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: 'rgba(218,236,240,0.34)',
  },
  dockGrid: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 1,
    borderColor: 'rgba(229, 241, 244, 0.16)',
    opacity: 0.56,
  },
  dockBeam: {
    position: 'absolute',
    left: -14,
    top: 10,
    width: 128,
    height: 36,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(255, 223, 196, 0.18)',
    transform: [{ rotate: '-6deg' }],
  },
  dockBottomLine: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 11,
    height: 1,
    backgroundColor: 'rgba(215, 229, 233, 0.4)',
  },
  dockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 9,
    paddingHorizontal: spacing.xs,
  },
  dockLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dockMarker: {
    width: 24,
    height: 3,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(197,108,71,0.4)',
  },
  dockEyebrow: {
    color: colors.techDark,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.25,
  },
  dockMeta: {
    color: colors.textSecondary,
    fontSize: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255, 253, 250, 0.96)',
    minHeight: 56,
    borderRadius: 20,
  },
  inputContent: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    paddingHorizontal: 4,
    color: colors.text,
  },
  sendButton: {
    margin: 0,
    width: 42,
    height: 42,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.techDark,
    borderWidth: 1,
    borderColor: 'rgba(223, 244, 248, 0.34)',
    shadowColor: colors.techDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(221, 226, 228, 0.9)',
    shadowOpacity: 0,
  },
})
