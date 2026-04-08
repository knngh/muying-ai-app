import React from 'react'
import { StyleSheet, View } from 'react-native'
import { IconButton, TextInput } from 'react-native-paper'
import { colors, spacing, borderRadius } from '../../theme'

interface ChatInputProps {
  value: string
  onChangeText: (text: string) => void
  onSend: () => void
  loading: boolean
}

export default function ChatInput({ value, onChangeText, onSend, loading }: ChatInputProps) {
  const disabled = !value.trim() || loading

  return (
    <View style={styles.inputWrap}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="输入你的问题，例如：本周产检前我该准备什么？"
        placeholderTextColor={colors.textSecondary}
        mode="outlined"
        style={styles.input}
        outlineColor={colors.border}
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
  )
}

const styles = StyleSheet.create({
  inputWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    backgroundColor: colors.white,
  },
  sendButton: {
    margin: 0,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.primary,
  },
  sendButtonDisabled: {
    backgroundColor: colors.textSecondary,
  },
})
