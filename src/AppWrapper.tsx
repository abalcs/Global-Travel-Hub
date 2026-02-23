import App from './App';

/**
 * AppWrapper
 * Shows the main app immediately (GTT Reports is public).
 * Auth resolves in the background — no loading gate needed.
 */
export function AppWrapper() {
  return <App />;
}
