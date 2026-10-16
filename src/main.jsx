import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import SchedulePanel from './screens/SchedulePanel.jsx'

// ?schedule at the end of the address opens the owner's banner schedule panel instead of the game
const schedulePanel = new URLSearchParams(location.search).has('schedule')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      {schedulePanel ? <SchedulePanel /> : <App />}
    </ErrorBoundary>
  </StrictMode>,
)
