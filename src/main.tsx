import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AppWrapper } from './AppWrapper.tsx'
import { ThemeProvider } from './contexts/ThemeContext.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <AppWrapper />
      </ThemeProvider>
    </AuthProvider>
  </StrictMode>,
)
