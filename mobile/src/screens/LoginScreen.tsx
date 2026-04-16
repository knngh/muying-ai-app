import React, { useState } from 'react'
import {
  View,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
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
import LaunchScreen from '../components/launch/LaunchScreen'

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

const benefitRows = [
  {
    icon: 'map-marker-path',
    title: '把阶段重点收拢到一个入口',
    description: '首页直接接住知识、问答、周报和成长日历，不用在多个页面之间来回找。',
  },
  {
    icon: 'clock-check-outline',
    title: '每次唤起都能继续上一次节奏',
    description: '登录后会沿用当前阶段与历史记录，把今天该做的事直接摆在面前。',
  },
]

const quickTags = ['知识库直达', '问题助手连续追问', '成长日历提醒', '阶段周报沉淀']

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
      <LinearGradient
        colors={['#FFF7F0', '#F8E6D9', '#E8F0F1']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.backgroundGradient}
      />
      <View style={styles.backgroundOrbTop} />
      <View style={styles.backgroundOrbBottom} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.heroWrap}>
            <LaunchScreen variant="welcome" />
          </View>

          <LinearGradient
            colors={['rgba(255,250,246,0.92)', 'rgba(247,236,227,0.92)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.valueCard}
          >
            <View style={styles.valueHeader}>
              <Text style={styles.valueEyebrow}>本次唤起后会得到什么</Text>
              <Text style={styles.valueTitle}>让首页在 3 秒内告诉你下一步该做什么</Text>
            </View>

            <View style={styles.quickTagRow}>
              {quickTags.map((tag) => (
                <Chip key={tag} compact style={styles.quickTag} textStyle={styles.quickTagText}>
                  {tag}
                </Chip>
              ))}
            </View>

            <View style={styles.benefitList}>
              {benefitRows.map((item) => (
                <View key={item.title} style={styles.benefitItem}>
                  <View style={styles.benefitIconWrap}>
                    <MaterialCommunityIcons name={item.icon} size={18} color={colors.techDark} />
                  </View>
                  <View style={styles.benefitTextWrap}>
                    <Text style={styles.benefitTitle}>{item.title}</Text>
                    <Text style={styles.benefitDescription}>{item.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          </LinearGradient>

          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.formHeader}>
                <Text style={styles.formTitle}>登录后继续</Text>
                <Text style={styles.formHint}>
                  当前是移动端入口，登录后会直接进入你的连续陪伴首页。
                </Text>
              </View>

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

              <Text style={styles.footerText}>
                登录后将自动恢复本机会话，并按你的当前阶段展示首页推荐、知识库文章与成长日历。
              </Text>
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
    backgroundColor: colors.backgroundSoft,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.lg,
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundOrbTop: {
    position: 'absolute',
    top: -90,
    right: -30,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(244,216,199,0.7)',
  },
  backgroundOrbBottom: {
    position: 'absolute',
    bottom: 10,
    left: -50,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(211,229,233,0.46)',
  },
  heroWrap: {
    height: 420,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.08)',
    shadowColor: colors.shadowStrong,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
  },
  valueCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.1)',
  },
  valueHeader: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  valueEyebrow: {
    color: colors.techDark,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  valueTitle: {
    color: colors.ink,
    fontSize: fontSize.xxl,
    lineHeight: 30,
    fontWeight: '800',
  },
  quickTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickTag: {
    backgroundColor: 'rgba(255,252,248,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.12)',
  },
  quickTagText: {
    color: colors.inkSoft,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  benefitList: {
    gap: spacing.md,
  },
  benefitItem: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  benefitIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.techLight,
    marginTop: 2,
  },
  benefitTextWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  benefitTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  benefitDescription: {
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: 'rgba(255,253,249,0.96)',
    borderRadius: borderRadius.xl,
    elevation: 0,
    paddingVertical: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.14)',
    shadowColor: colors.inkSoft,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
  },
  formHeader: {
    marginBottom: spacing.lg,
  },
  formTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  formHint: {
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.textSecondary,
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
  footerText: {
    marginTop: spacing.md,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },
})
