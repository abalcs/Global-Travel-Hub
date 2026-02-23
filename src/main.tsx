import { StrictMode, Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AppWrapper } from './AppWrapper.tsx'
import { ThemeProvider } from './contexts/ThemeContext.tsx'
// Auth disabled for now — uncomment when ready to re-enable
// import { AuthProvider } from './contexts/AuthContext.tsx'

/**
 * Error Boundary — catches any uncaught errors during rendering
 * and shows a fallback UI instead of a blank white page.
 */
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontFamily: 'Inter, system-ui, sans-serif',
          padding: '2rem',
          textAlign: 'center',
          background: '#f8fafc',
        }}>
          <h1 style={{ fontSize: '1.5rem', color: '#1e40af', marginBottom: '1rem' }}>
            Global Travel Hub
          </h1>
          <p style={{ color: '#64748b', marginBottom: '1rem' }}>
            Something went wrong loading the application.
          </p>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            {this.state.error?.message || 'Unknown error'}
          </p>
          <button
            onClick={() => {
              try { localStorage.clear() } catch (_) {}
              try {
                indexedDB.databases?.().then(dbs => {
                  dbs.forEach(d => d.name && indexedDB.deleteDatabase(d.name))
                })
              } catch (_) {}
              window.location.reload()
            }}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#1e40af',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Clear Cache & Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {/* Auth disabled — uncomment AuthProvider when ready to re-enable */}
      {/* <AuthProvider> */}
        <ThemeProvider>
          <AppWrapper />
        </ThemeProvider>
      {/* </AuthProvider> */}
    </ErrorBoundary>
  </StrictMode>,
)
