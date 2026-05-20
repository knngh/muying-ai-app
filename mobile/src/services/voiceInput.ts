import { NativeModules, PermissionsAndroid, Platform } from 'react-native'

type VoiceInputNativeModule = {
  isAvailable: () => Promise<boolean>
  startRecognition: (locale: string, timeoutMs: number) => Promise<string>
  cancelRecognition?: () => Promise<void>
}

type VoiceInputDependencies = {
  platformOS: typeof Platform.OS
  nativeModule?: VoiceInputNativeModule
  requestAndroidAudioPermission: () => Promise<boolean>
}

export type VoiceInputErrorCode =
  | 'VOICE_MODULE_UNAVAILABLE'
  | 'VOICE_RECOGNITION_UNAVAILABLE'
  | 'VOICE_PERMISSION_DENIED'
  | 'VOICE_RECOGNITION_NO_MATCH'
  | 'VOICE_RECOGNITION_BUSY'
  | 'VOICE_RECOGNITION_FAILED'

export class VoiceInputError extends Error {
  code: VoiceInputErrorCode

  constructor(code: VoiceInputErrorCode, message: string) {
    super(message)
    this.name = 'VoiceInputError'
    this.code = code
  }
}

const nativeVoiceModule = NativeModules.BeihuVoiceRecognition as VoiceInputNativeModule | undefined

async function requestAndroidAudioPermission() {
  if (Platform.OS !== 'android') {
    return true
  }

  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO)
  return result === PermissionsAndroid.RESULTS.GRANTED
}

const defaultDependencies: VoiceInputDependencies = {
  platformOS: Platform.OS,
  nativeModule: nativeVoiceModule,
  requestAndroidAudioPermission,
}

export function normalizeVoiceTranscript(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

export function getVoiceInputErrorMessage(error: unknown) {
  const code = error instanceof VoiceInputError
    ? error.code
    : typeof error === 'object' && error && 'code' in error && typeof error.code === 'string'
      ? error.code
      : ''

  switch (code) {
    case 'VOICE_PERMISSION_DENIED':
      return '需要开启麦克风和语音识别权限后才能语音输入'
    case 'VOICE_RECOGNITION_UNAVAILABLE':
    case 'VOICE_MODULE_UNAVAILABLE':
      return '当前设备暂不支持系统语音输入'
    case 'VOICE_RECOGNITION_NO_MATCH':
      return '没有识别到清晰语音，可以靠近一点再试'
    case 'VOICE_RECOGNITION_BUSY':
      return '语音输入正在进行中'
    default:
      return '语音输入失败，请稍后再试'
  }
}

export async function transcribeVoiceQuestion(
  options: { locale?: string; timeoutMs?: number } = {},
  dependencies: VoiceInputDependencies = defaultDependencies,
) {
  const module = dependencies.nativeModule
  if (!module) {
    throw new VoiceInputError('VOICE_MODULE_UNAVAILABLE', 'Voice input native module is unavailable')
  }

  const available = await module.isAvailable()
  if (!available) {
    throw new VoiceInputError('VOICE_RECOGNITION_UNAVAILABLE', 'Voice recognition is unavailable')
  }

  if (dependencies.platformOS === 'android') {
    const granted = await dependencies.requestAndroidAudioPermission()
    if (!granted) {
      throw new VoiceInputError('VOICE_PERMISSION_DENIED', 'Microphone permission denied')
    }
  }

  const transcript = normalizeVoiceTranscript(await module.startRecognition(
    options.locale || 'zh-CN',
    options.timeoutMs ?? 18000,
  ))

  if (!transcript) {
    throw new VoiceInputError('VOICE_RECOGNITION_NO_MATCH', 'Empty voice transcript')
  }

  return transcript
}
