import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import SiteNavigation from './SiteNavigation.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteNavigation />
  </StrictMode>,
)
