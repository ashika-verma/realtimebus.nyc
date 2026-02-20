import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { LocationProvider } from './contexts/LocationContext'
import './index.css'

// Remove the inline loading splash once React is ready to render
document.getElementById('splash')?.remove()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <LocationProvider>
        <App />
      </LocationProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
