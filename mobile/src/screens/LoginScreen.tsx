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
  Chip,
} from 'react-native-paper'
import LinearGradient from 'react-native-linear-gradient'
import { config } from '../config'
import { authApi } from '../api/modules'
import { useAppStore } from '../stores/appStore'
import { colors, spacing, fontSize, borderRadius } from '../theme'
import { sessionStorage } from '../utils/storage'

interface LoginScreenProps {
  onLoginSuccess: () => Promise<void>
  navigation: any
}

const demoAccounts = [
  {
    key: 'free',
    label: '基础状态',
    username: 'demo_free_user',
    description: '快速填入未开通陪伴方案的账号名，口令仍需单独输入。',
  },
  {
    key: 'vip',
    label: '陪伴状态',
    username: 'demo_vip_user',
    description: '快速填入已开通陪伴方案的账号名，口令仍需单独输入。',
  },
]

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [mode, setMode] = useState<string>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [secureEntry, setSecureEntry] = useState(true)
  const [showDevAssist, setShowDevAssist] = useState(false)

  const { setUser, setToken } = useAppStore()

  const isRegister = mode === 'register'

  const applyDemoAccount = (account: (typeof demoAccounts)[number]) => {
    setMode('login')
    setUsername(account.username)
    setPhone('')
    setEmail('')
    setError('')
  }

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

      await sessionStorage.setToken(response.token)
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
              <LinearGradient
                colors={['rgba(246,225,212,0.96)', 'rgba(250,242,235,0.94)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroPanel}
              >
                <View style={styles.heroGlow} />
                <Chip compact style={styles.heroChip} textStyle={styles.heroChipText}>
                  全生命周期陪伴
                </Chip>
                <Text style={styles.title}>贝护妈妈</Text>
                <Text style={styles.heroSubtitle}>
                  从备孕到育儿，把知识、问答和成长日历放进同一条连续时间线。
                </Text>
              </LinearGradient>

              <Text style={styles.introText}>
                使用账号登录后，首页、问题助手、日历和周报会围绕你的当前阶段联动。
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

              {config.enableDemoAccounts ? (
                <View style={styles.demoSection}>
                  <View style={styles.demoHeader}>
                    <View style={styles.demoHeaderText}>
                      <Text style={styles.demoTitle}>本机调试辅助</Text>
                      <Text style={styles.demoHint}>只在开发环境显示，用于快速填入示例账号名。</Text>
                    </View>
                    <Button
                      compact
                      mode={showDevAssist ? 'outlined' : 'text'}
                      onPress={() => setShowDevAssist((prev) => !prev)}
                      textColor={colors.techDark}
                    >
                      {showDevAssist ? '收起' : '展开'}
                    </Button>
                  </View>
                  {showDevAssist ? demoAccounts.map((account) => (
                    <View key={account.key} style={styles.demoCard}>
                      <View style={styles.demoTextWrap}>
                        <Text style={styles.demoCardTitle}>{account.label}</Text>
                        <Text style={styles.demoCardDesc}>{account.description}</Text>
                      </View>
                      <Button
                        mode="outlined"
                        compact
                        onPress={() => applyDemoAccount(account)}
                        textColor={colors.primary}
                      >
                        使用
                      </Button>
                    </View>
                  )) : null}
                </View>
              ) : null}

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
    paddingVertical: spacing.xl,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    elevation: 0,
    paddingVertical: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.inkSoft,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
  },
  heroPanel: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -24,
    right: -16,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,249,244,0.44)',
  },
  heroChip: {
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
    backgroundColor: 'rgba(255,253,249,0.88)',
  },
  heroChipText: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  heroSubtitle: {
    fontSize: fontSize.md,
    color: colors.inkSoft,
    lineHeight: 22,
  },
  introText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  segmented: {
    marginBottom: spacing.lg,
  },
  demoSection: {
    marginBottom: spacing.md,
    padding: spacing.sm + 4,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(250,243,236,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.12)',
    gap: spacing.sm,
  },
  demoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  demoHeaderText: {
    flex: 1,
    gap: 2,
  },
  demoTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.techDark,
  },
  demoHint: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  demoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: 14,
    backgroundColor: 'rgba(255,252,248,0.92)',
  },
  demoTextWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  demoCardTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
  },
  demoCardDesc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 18,
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
