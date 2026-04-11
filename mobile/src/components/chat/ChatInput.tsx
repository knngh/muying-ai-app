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
      {hint ? <Text style={styles.inputHint}>{hint}</Text> : null}

      <View style={styles.dock}>
        <View style={styles.dockGlow} />
        <View style={styles.dockHeader}>
          <View style={styles.dockLabelRow}>
            <View style={styles.dockMarker} />
            <Text style={styles.dockEyebrow}>提问输入区</Text>
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
            outlineColor="rgba(184,138,72,0.14)"
            activeOutlineColor={colors.primary}
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
  inputHint: {
    marginBottom: spacing.sm,
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 18,
  },
  dock: {
    padding: spacing.sm,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    shadowColor: colors.inkSoft,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    overflow: 'hidden',
  },
  dockGlow: {
    position: 'absolute',
    top: -18,
    right: -8,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(220,236,238,0.36)',
  },
  dockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  dockLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dockMarker: {
    width: 26,
    height: 4,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(185,104,66,0.32)',
  },
  dockEyebrow: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  dockMeta: {
    color: colors.textLight,
    fontSize: 11,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255, 252, 248, 0.98)',
    minHeight: 56,
  },
  inputContent: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    color: colors.text,
  },
  sendButton: {
    margin: 0,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.copper,
    shadowColor: colors.copper,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    shadowOpacity: 0,
  },
})
