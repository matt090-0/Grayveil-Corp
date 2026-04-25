import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import RouteFallback from './components/RouteFallback'

// ─────────────────────────────────────────────────────────────
// Route-level code-splitting.
// Each page is loaded on demand — the initial bundle now only
// contains Layout + auth + the route shell. Heavy pages
// (Dashboard with recharts, Wiki/OpTemplates with markdown,
// Bank with the credit-card SVGs) only ship when visited.
//
// Suspense fallback matches the UEE chrome so transitions don't
// look like a fail.
// ─────────────────────────────────────────────────────────────
const Auth         = lazy(() => import('./pages/Auth'))
const SetupProfile = lazy(() => import('./pages/SetupProfile'))
const Dashboard    = lazy(() => import('./pages/Dashboard'))
const Roster       = lazy(() => import('./pages/Roster'))
const Fleet        = lazy(() => import('./pages/Fleet'))
const Contracts    = lazy(() => import('./pages/Contracts'))
const Intelligence = lazy(() => import('./pages/Intelligence'))
const Ledger       = lazy(() => import('./pages/Ledger'))
const Recruitment  = lazy(() => import('./pages/Recruitment'))
const Polls        = lazy(() => import('./pages/Polls'))
const Profile      = lazy(() => import('./pages/Profile'))
const Admin        = lazy(() => import('./pages/Admin'))
const Apply        = lazy(() => import('./pages/Apply'))
const Bank         = lazy(() => import('./pages/Bank'))
const Events       = lazy(() => import('./pages/Events'))
const Diplomacy    = lazy(() => import('./pages/Diplomacy'))
const KillBoard    = lazy(() => import('./pages/KillBoard'))
const Wiki         = lazy(() => import('./pages/Wiki'))
const Loadouts     = lazy(() => import('./pages/Loadouts'))
const Medals       = lazy(() => import('./pages/Medals'))
const Landing      = lazy(() => import('./pages/Landing'))
const Messages     = lazy(() => import('./pages/Messages'))
const Bounties     = lazy(() => import('./pages/Bounties'))
const AARs         = lazy(() => import('./pages/AARs'))
const Reputation   = lazy(() => import('./pages/Reputation'))
const Referrals    = lazy(() => import('./pages/Referrals'))
const OpTemplates  = lazy(() => import('./pages/OpTemplates'))
const ShipCalendar = lazy(() => import('./pages/ShipCalendar'))
const Blacklist    = lazy(() => import('./pages/Blacklist'))
const PublicOrg    = lazy(() => import('./pages/PublicOrg'))
const Updates      = lazy(() => import('./pages/Updates'))
const Marketplace  = lazy(() => import('./pages/Marketplace'))
const Inbox        = lazy(() => import('./pages/Inbox'))

// Wraps the page tree in a Suspense boundary so each lazy-loaded
// route gets a UEE-styled "incoming transmission" placeholder
// while its chunk arrives.
function Page({ children, gated, minTier }) {
  const inner = (
    <Layout>
      <Suspense fallback={<RouteFallback />}>
        {children}
      </Suspense>
    </Layout>
  )
  if (gated) {
    return <ProtectedRoute minTier={minTier}>{inner}</ProtectedRoute>
  }
  return inner
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback fullscreen />}>
      <Routes>
        <Route path="/auth"    element={<Auth />} />
        <Route path="/setup"   element={<SetupProfile />} />
        <Route path="/apply"   element={<Apply />} />
        <Route path="/welcome" element={<Landing />} />
        <Route path="/org"     element={<PublicOrg />} />

        <Route path="/"             element={<Page gated><Dashboard /></Page>} />
        <Route path="/roster"       element={<Page gated><Roster /></Page>} />
        <Route path="/fleet"        element={<Page gated><Fleet /></Page>} />
        <Route path="/contracts"    element={<Page gated><Contracts /></Page>} />
        <Route path="/intelligence" element={<Page gated><Intelligence /></Page>} />
        <Route path="/ledger"       element={<Page gated><Ledger /></Page>} />
        <Route path="/recruitment"  element={<Page gated minTier={6}><Recruitment /></Page>} />
        <Route path="/polls"        element={<Page gated><Polls /></Page>} />
        <Route path="/bank"         element={<Page gated><Bank /></Page>} />
        <Route path="/market"       element={<Page gated><Marketplace /></Page>} />
        <Route path="/events"       element={<Page gated><Events /></Page>} />
        <Route path="/diplomacy"    element={<Page gated minTier={6}><Diplomacy /></Page>} />
        <Route path="/killboard"    element={<Page gated><KillBoard /></Page>} />
        <Route path="/wiki"         element={<Page gated><Wiki /></Page>} />
        <Route path="/loadouts"     element={<Page gated><Loadouts /></Page>} />
        <Route path="/medals"       element={<Page gated><Medals /></Page>} />
        <Route path="/messages"     element={<Page gated><Messages /></Page>} />
        <Route path="/bounties"     element={<Page gated><Bounties /></Page>} />
        <Route path="/templates"    element={<Page gated><OpTemplates /></Page>} />
        <Route path="/aars"         element={<Page gated><AARs /></Page>} />
        <Route path="/reputation"   element={<Page gated><Reputation /></Page>} />
        <Route path="/ships"        element={<Page gated><ShipCalendar /></Page>} />
        <Route path="/blacklist"    element={<Page gated><Blacklist /></Page>} />
        <Route path="/referrals"    element={<Page gated><Referrals /></Page>} />
        <Route path="/updates"      element={<Page gated><Updates /></Page>} />
        <Route path="/inbox"        element={<Page gated><Inbox /></Page>} />
        <Route path="/profile"      element={<Page gated><Profile /></Page>} />
        <Route path="/admin"        element={<Page gated minTier={1}><Admin /></Page>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
