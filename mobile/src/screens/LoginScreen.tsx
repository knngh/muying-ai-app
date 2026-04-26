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
import type { User } from '../api/modules'
import { useAppStore } from '../stores/appStore'
import { colors, spacing, fontSize, borderRadius } from '../theme'
import { sessionStorage } from '../utils/storage'
import LaunchScreen from '../components/launch/LaunchScreen'

interface LoginScreenProps {
  onLoginSuccess: () => Promise<void>
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

const flowRows = [
  {
    icon: 'book-open-page-variant-outline',
    title: '阶段知识不是泛信息流',
    description: '知识库会优先围绕当前阶段给内容，不是把所有母婴主题平铺给用户自己筛。',
  },
  {
    icon: 'calendar-heart',
    title: '成长日历接住今天该做什么',
    description: '产检、提醒、待办和家庭安排会落到同一条时间线上，减少“看完就断掉”。',
  },
  {
    icon: 'file-chart-outline',
    title: '周报负责把本周重点收口',
    description: '周报不是一次性海报，而是帮你把当前阶段的重点提醒和执行节奏沉淀成回顾。',
  },
  {
    icon: 'timeline-text-outline',
    title: '成长档案留住长期变化',
    description: '记录、问答和阶段变化会逐步累成成长档案，适合后面回看和家庭协作。',
  },
]

const lifecycleScenes = [
  {
    label: '备孕',
    description: '把准备期知识、检查与节律收拢到一个入口',
  },
  {
    label: '孕期',
    description: '围绕孕周组织知识、日历、周报和阅读问答',
  },
  {
    label: '产后恢复',
    description: '接住恢复、喂养、作息与家人分工',
  },
  {
    label: '育儿阶段',
    description: '把阶段提醒和成长记录沉淀进长期档案',
  },
]

const quickTags = ['当前阶段优先', '知识库与日历联动', '周报持续回顾', '档案长期沉淀']

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
      let response: { user: User; token: string }
      if (isRegister) {
        response = await authApi.register({
          username: username.trim(),
          password: password.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
        })
      } else {
        response = await authApi.login({
          username: username.trim(),
          password: password.trim(),
        })
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
            <LaunchScreen
              variant="welcome"
              compact
              title="你的项目核心不是登录，而是把连续陪伴接上"
              subtitle="贝护妈妈移动端会围绕当前阶段，把知识库、成长日历、周报和成长档案接成一条可持续使用的链路。"
              statusTitle="登录后会优先恢复什么"
              statusText="先拿到当前阶段，再恢复首页推荐、阅读问答配额和后续周报入口，让用户一进来就知道今天下一步是什么。"
              spotlight={{
                eyebrow: '项目核心链路',
                title: '阶段知识 -> 今天安排 -> 周报回顾 -> 成长档案',
                caption: '这不是通用母婴 App 的登录页，而是连续陪伴系统的移动端入口。',
              }}
              journey={['备孕', '孕期', '产后恢复', '育儿阶段']}
            />
          </View>

          <LinearGradient
            colors={['rgba(255,250,246,0.92)', 'rgba(247,236,227,0.92)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.journeyCard}
          >
            <View style={styles.valueHeader}>
              <Text style={styles.valueEyebrow}>这套入口服务哪些阶段</Text>
              <Text style={styles.valueTitle}>从备孕到育儿，不同阶段进入后看到的重点应该不同</Text>
            </View>

            <View style={styles.quickTagRow}>
              {quickTags.map((tag) => (
                <Chip key={tag} compact style={styles.quickTag} textStyle={styles.quickTagText}>
                  {tag}
                </Chip>
              ))}
            </View>

            <View style={styles.lifecycleGrid}>
              {lifecycleScenes.map((item) => (
                <View key={item.label} style={styles.lifecycleCard}>
                  <Text style={styles.lifecycleLabel}>{item.label}</Text>
                  <Text style={styles.lifecycleDescription}>{item.description}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>

          <Card style={styles.projectCard}>
            <Card.Content>
              <Text style={styles.projectEyebrow}>登录后为什么会更像你的项目</Text>
              <Text style={styles.projectTitle}>入口页必须直接承接连续陪伴，而不是只做账号验证</Text>

              <View style={styles.benefitList}>
                {flowRows.map((item) => (
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
            </Card.Content>
          </Card>

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
  journeyCard: {
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
  lifecycleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  lifecycleCard: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 112,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    backgroundColor: 'rgba(255,252,248,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.1)',
  },
  lifecycleLabel: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  lifecycleDescription: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  projectCard: {
    backgroundColor: 'rgba(255,253,249,0.94)',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.1)',
    shadowColor: colors.shadowSoft,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  projectEyebrow: {
    color: colors.techDark,
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  projectTitle: {
    color: colors.ink,
    fontSize: fontSize.xxl,
    lineHeight: 30,
    fontWeight: '800',
    marginBottom: spacing.lg,
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
