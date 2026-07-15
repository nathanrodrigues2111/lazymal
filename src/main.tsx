import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LazyMotion } from 'motion/react'
import './index.css'
import App from './App.tsx'

// Load Framer Motion's feature bundle asynchronously so it's off the initial
// critical path: the app shell paints first, animations hydrate a beat later.
// Components use the lightweight `m` component; `domMax` covers layout + drag.
const loadFeatures = () => import('motion/react').then((mod) => mod.domMax)

// The PWA service worker auto-updates (skipWaiting + clientsClaim). When the new
// worker takes control, reload once so users always land on the latest build
// instead of a stale cached one. Guard against the first-install claim and
// against reload loops.
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller
  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing || !hadController) return
    refreshing = true
    window.location.reload()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LazyMotion features={loadFeatures}>
      <App />
    </LazyMotion>
  </StrictMode>,
)
