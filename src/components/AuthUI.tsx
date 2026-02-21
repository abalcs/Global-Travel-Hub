import { useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import './AuthUI.css';

export function AuthUI() {
  const { user, loading, error, login, signup, logout, clearError } = useAuthContext();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    clearError();

    try {
      if (isSignup) {
        await signup(email, password);
      } else {
        await login(email, password);
      }
      setEmail('');
      setPassword('');
    } catch {
      // Error is handled by useAuth hook
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // Error is handled by useAuth hook
    }
  };

  if (loading) {
    return (
      <div className="auth-container">
        <div className="auth-box">
          <p>Loading authentication...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="auth-container">
        <div className="auth-box auth-success">
          <p>Welcome, {user.email}</p>
          <button onClick={handleLogout} className="auth-button logout-button">
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>{isSignup ? 'Create Account' : 'Login'}</h2>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={isLoading}
            />
          </div>

          <button type="submit" className="auth-button" disabled={isLoading}>
            {isLoading ? 'Loading...' : isSignup ? 'Sign Up' : 'Login'}
          </button>
        </form>

        <p className="auth-toggle">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={() => {
              setIsSignup(!isSignup);
              clearError();
              setEmail('');
              setPassword('');
            }}
            className="toggle-button"
            disabled={isLoading}
          >
            {isSignup ? 'Login' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  );
}
