const __DEV__ = process.env.NODE_ENV !== 'production'

export const config = {
  apiBaseUrl: 'https://beihu.me/api/v1',
  wsBaseUrl: 'wss://beihu.me',
  enableDemoAccounts: __DEV__,
  enableMockPayments: false,
  enableDebugLogs: __DEV__,
  enablePublicAiFeatures: true,
}
