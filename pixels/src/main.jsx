import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Splash from './components/splash.jsx'

function Main() {
  const [showSplash, setShowSplash] = useState(true)

  return (
    <StrictMode>
      {showSplash && <Splash onComplete={() => setShowSplash(false)} />}
      <App />
    </StrictMode>
  )
}

createRoot(document.getElementById('root')).render(<Main />)