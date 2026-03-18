import React, { useState } from 'react'
import {
  View,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import {
  Text,
  Card,
  TextInput,
  Button,
  SegmentedButtons,
  HelperText,
} from 'react-native-paper'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { authApi } from '../api/modules'
import { useAppStore } from '../stores/appStore'
import { colors, spacing, fontSize } from '../theme'

interface LoginScreenProps {
  onLoginSuccess: () => Promise<void>
  navigation: any
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [mode, setMode] = useState<string>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [secureEntry, setSecureEntry] = useState(true)

  const { setUser, setToken } = useAppStore()

  const isRegister = mode === 'register'

  const validate = (): boolean => {
    if (!username.trim()) {
      setError('请输入用户名')
      return false
    }
    if (!password.trim()) {
      setError('请输入密码')
      return false
    }
    if (password.length < 6) {
      setError('密码长度不能少于6位')
      return false
    }
    return true
  }

  const handleSubmit = async () => {
    setError('')
    if (!validate()) return

    setLoading(true)
    try {
      let response: { user: any; token: string }

      if (isRegister) {
        response = await authApi.register({
          username: username.trim(),
          password: password.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
        }) as { user: any; token: string }
      } else {
        response = await authApi.login({
          username: username.trim(),
          password: password.trim(),
        }) as { user: any; token: string }
      }

      await AsyncStorage.setItem('token', response.token)
      setToken(response.token)
      setUser(response.user)
      await onLoginSuccess()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string }
      setError(
        e.response?.data?.message ||
        e.message ||
        (isRegister ? '注册失败，请重试' : '登录失败，请检查用户名和密码')
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.title}>母婴AI助手</Text>
              <Text style={styles.subtitle}>
                智能问答 · 科学孕育 · 贴心陪伴
              </Text>

              <SegmentedButtons
                value={mode}
                onValueChange={(val) => {
                  setMode(val)
                  setError('')
                }}
                buttons={[
                  { value: 'login', label: '登录' },
                  { value: 'register', label: '注册' },
                ]}
                style={styles.segmented}
              />

              <TextInput
                label="用户名"
                value={username}
                onChangeText={(text) => {
                  setUsername(text)
                  setError('')
                }}
                style={styles.input}
                mode="outlined"
                outlineColor={colors.border}
                activeOutlineColor={colors.primary}
                autoCapitalize="none"
                left={<TextInput.Icon icon="account" />}
              />

              <TextInput
                label="密码"
                value={password}
                onChangeText={(text) => {
                  setPassword(text)
                  setError('')
                }}
                style={styles.input}
                mode="outlined"
                outlineColor={colors.border}
                activeOutlineColor={colors.primary}
                secureTextEntry={secureEntry}
                left={<TextInput.Icon icon="lock" />}
                right={
                  <TextInput.Icon
                    icon={secureEntry ? 'eye-off' : 'eye'}
                    onPress={() => setSecureEntry(!secureEntry)}
                  />
                }
              />

              {isRegister && (
                <>
                  <TextInput
                    label="手机号（选填）"
                    value={phone}
                    onChangeText={setPhone}
                    style={styles.input}
                    mode="outlined"
                    outlineColor={colors.border}
                    activeOutlineColor={colors.primary}
                    keyboardType="phone-pad"
                    left={<TextInput.Icon icon="phone" />}
                  />

                  <TextInput
                    label="邮箱（选填）"
                    value={email}
                    onChangeText={setEmail}
                    style={styles.input}
                    mode="outlined"
                    outlineColor={colors.border}
                    activeOutlineColor={colors.primary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    left={<TextInput.Icon icon="email" />}
                  />
                </>
              )}

              {error ? (
                <HelperText type="error" visible={!!error} style={styles.errorText}>
                  {error}
                </HelperText>
              ) : null}

              <Button
                mode="contained"
                onPress={handleSubmit}
                loading={loading}
                disabled={loading}
                style={styles.submitButton}
                buttonColor={colors.primary}
                textColor={colors.white}
              >
                {isRegister ? '注册' : '登录'}
              </Button>
            </Card.Content>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primaryLight,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    elevation: 4,
    paddingVertical: spacing.lg,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: 'bold',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  segmented: {
    marginBottom: spacing.lg,
  },
  input: {
    marginBottom: spacing.md,
    backgroundColor: colors.white,
  },
  errorText: {
    fontSize: fontSize.sm,
  },
  submitButton: {
    marginTop: spacing.sm,
    borderRadius: 24,
    paddingVertical: spacing.xs,
  },
})
