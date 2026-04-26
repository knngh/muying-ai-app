import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            padding: 24,
            background:
              'radial-gradient(circle at top, rgba(255, 226, 214, 0.9), rgba(248, 244, 238, 1) 45%, rgba(241, 236, 229, 1))',
          }}
        >
          <div
            style={{
              width: 'min(100%, 420px)',
              padding: 32,
              borderRadius: 24,
              background: 'rgba(255, 255, 255, 0.92)',
              boxShadow: '0 24px 80px rgba(111, 78, 55, 0.14)',
              border: '1px solid rgba(160, 121, 98, 0.14)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                margin: '0 auto 16px',
                borderRadius: 16,
                display: 'grid',
                placeItems: 'center',
                background: 'linear-gradient(135deg, #ffb88c, #de7864)',
                color: '#fff',
                fontSize: 28,
                fontWeight: 700,
              }}
            >
              !
            </div>
            <h1 style={{ margin: 0, fontSize: 24, color: '#3c2f2a' }}>页面出错了</h1>
            <p style={{ margin: '12px 0 24px', color: '#76655d', lineHeight: 1.7 }}>
              请刷新页面重试，如果问题持续存在请联系客服。
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                border: 'none',
                borderRadius: 999,
                padding: '12px 20px',
                background: 'linear-gradient(135deg, #de7864, #c85b43)',
                color: '#fff',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              刷新页面
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
