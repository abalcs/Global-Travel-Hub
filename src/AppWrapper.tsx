import { useAuthContext } from './contexts/AuthContext';
import { AuthUI } from './components/AuthUI';
import App from './App';

/**
 * AppWrapper
 * Shows authentication UI if user is not logged in, otherwise shows the main app
 */
export function AppWrapper() {
  const { user, loading } = useAuthContext();

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
        Loading...
      </div>
    );
  }

  if (!user) {
    return <AuthUI />;
  }

  return <App />;
}
