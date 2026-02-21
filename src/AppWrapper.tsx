import { useAuthContext } from './contexts/AuthContext';
import App from './App';

/**
 * AppWrapper
 * Shows the main app (GTT Reports is accessible without login)
 * Authenticated features can check user state internally
 */
export function AppWrapper() {
  const { loading } = useAuthContext();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        fontSize: '18px',
        color: '#666',
      }}>
        ⏳ Loading...
      </div>
    );
  }

  // Show app regardless of auth - GTT Reports tab is public
  // Other features can show login prompt if needed
  return <App />;
}
