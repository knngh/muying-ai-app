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
      <View style={styles.dock}>
        <View style={styles.inputRow}>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder="输入一个具体问题"
            placeholderTextColor={colors.textSecondary}
            mode="outlined"
            style={styles.input}
            contentStyle={styles.inputContent}
            outlineColor="rgba(164, 198, 205, 0.38)"
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
        {hint ? <Text numberOfLines={2} style={styles.inputHint}>{hint}</Text> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  inputWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: 98,
    paddingTop: spacing.sm,
    backgroundColor: 'transparent',
  },
  inputHint: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 15,
  },
  dock: {
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255, 253, 250, 0.97)',
    borderWidth: 1,
    borderColor: 'rgba(190, 210, 216, 0.72)',
    shadowColor: colors.inkSoft,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.white,
    minHeight: 52,
    borderRadius: borderRadius.md,
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
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(221, 226, 228, 0.9)',
  },
})
