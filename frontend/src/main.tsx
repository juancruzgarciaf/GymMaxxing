import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.tsx'

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

const app = (
  <BrowserRouter>
    <App />
  </BrowserRouter>
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {googleClientId ? (
      <GoogleOAuthProvider clientId={googleClientId}>
        {app}
      </GoogleOAuthProvider>
    ) : (
      app
    )}
  </StrictMode>,
)
