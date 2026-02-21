import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { LanguageProvider } from './contexts/LanguageContext'
import { SoundProvider } from './contexts/SoundContext'
import { SocketProvider } from './contexts/SocketContext'
import { GroupProvider } from './contexts/GroupContext'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <SoundProvider>
          <AuthProvider>
            <SocketProvider>
              <GroupProvider>
                <App />
              </GroupProvider>
            </SocketProvider>
          </AuthProvider>
        </SoundProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
