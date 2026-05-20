import {
  VoiceInputError,
  getVoiceInputErrorMessage,
  normalizeVoiceTranscript,
  transcribeVoiceQuestion,
} from './voiceInput'

describe('voiceInput', () => {
  it('normalizes recognized transcript text', () => {
    expect(normalizeVoiceTranscript('  宝宝   今天\n吃奶 怎么办  ')).toBe('宝宝 今天 吃奶 怎么办')
  })

  it('requests Android microphone permission before recognition', async () => {
    const nativeModule = {
      isAvailable: jest.fn().mockResolvedValue(true),
      startRecognition: jest.fn().mockResolvedValue(' 宝宝夜醒怎么办 '),
    }
    const requestAndroidAudioPermission = jest.fn().mockResolvedValue(true)

    await expect(transcribeVoiceQuestion({}, {
      platformOS: 'android',
      nativeModule,
      requestAndroidAudioPermission,
    })).resolves.toBe('宝宝夜醒怎么办')

    expect(requestAndroidAudioPermission).toHaveBeenCalledTimes(1)
    expect(nativeModule.startRecognition).toHaveBeenCalledWith('zh-CN', 18000)
  })

  it('fails when Android microphone permission is denied', async () => {
    const nativeModule = {
      isAvailable: jest.fn().mockResolvedValue(true),
      startRecognition: jest.fn(),
    }

    await expect(transcribeVoiceQuestion({}, {
      platformOS: 'android',
      nativeModule,
      requestAndroidAudioPermission: jest.fn().mockResolvedValue(false),
    })).rejects.toMatchObject({ code: 'VOICE_PERMISSION_DENIED' })
    expect(nativeModule.startRecognition).not.toHaveBeenCalled()
  })

  it('maps native errors to user-facing text', () => {
    expect(getVoiceInputErrorMessage(new VoiceInputError(
      'VOICE_RECOGNITION_NO_MATCH',
      'No match',
    ))).toBe('没有识别到清晰语音，可以靠近一点再试')
  })
})
