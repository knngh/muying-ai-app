const __DEV__ = process.env.NODE_ENV !== 'production'

export const config = {
  apiBaseUrl: __DEV__ ? 'http://localhost:3000/api/v1' : 'https://your-domain.com/api/v1',
  wsBaseUrl: __DEV__ ? 'ws://localhost:3000' : 'wss://your-domain.com',
}
