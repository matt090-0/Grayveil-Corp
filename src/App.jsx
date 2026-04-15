import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Auth from './pages/Auth'
import SetupProfile from './pages/SetupProfile'
import Dashboard from './pages/Dashboard'
import Roster from './pages/Roster'
import Fleet from './pages/Fleet'
import Contracts from './pages/Contracts'
import Intelligence from './pages/Intelligence'
import Ledger from './pages/Ledger'
import Recruitment from './pages/Recruitment'
import Polls from './pages/Polls'
import Profile from './pages/Profile'
import Admin from './pages/Admin'
import Apply from './pages/Apply'
import Bank from './pages/Bank'
import Events from './pages/Events'
import Diplomacy from './pages/Diplomacy'
import KillBoard from './pages/KillBoard'
import Wiki from './pages/Wiki'
import Loadouts from './pages/Loadouts'
import Medals from './pages/Medals'
import Landing from './pages/Landing'
import Messages from './pages/Messages'
import Bounties from './pages/Bounties'
import AARs from './pages/AARs'
import Reputation from './pages/Reputation'
import Referrals from './pages/Referrals'
import OpTemplates from './pages/OpTemplates'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth"  element={<Auth />} />
      <Route path="/setup" element={<SetupProfile />} />
      <Route path="/apply" element={<Apply />} />
      <Route path="/welcome" element={<Landing />} />

      <Route path="/" element={
        <ProtectedRoute>
          <Layout><Dashboard /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/roster" element={
        <ProtectedRoute>
          <Layout><Roster /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/fleet" element={
        <ProtectedRoute>
          <Layout><Fleet /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/contracts" element={
        <ProtectedRoute>
          <Layout><Contracts /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/intelligence" element={
        <ProtectedRoute>
          <Layout><Intelligence /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/ledger" element={
        <ProtectedRoute>
          <Layout><Ledger /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/recruitment" element={
        <ProtectedRoute minTier={6}>
          <Layout><Recruitment /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/polls" element={
        <ProtectedRoute>
          <Layout><Polls /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/bank" element={
        <ProtectedRoute>
          <Layout><Bank /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/events" element={
        <ProtectedRoute>
          <Layout><Events /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/diplomacy" element={
        <ProtectedRoute minTier={6}>
          <Layout><Diplomacy /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/killboard" element={
        <ProtectedRoute>
          <Layout><KillBoard /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/wiki" element={
        <ProtectedRoute>
          <Layout><Wiki /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/loadouts" element={
        <ProtectedRoute>
          <Layout><Loadouts /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/medals" element={
        <ProtectedRoute>
          <Layout><Medals /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/messages" element={
        <ProtectedRoute>
          <Layout><Messages /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/bounties" element={
        <ProtectedRoute>
          <Layout><Bounties /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/templates" element={
        <ProtectedRoute>
          <Layout><OpTemplates /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/aars" element={
        <ProtectedRoute>
          <Layout><AARs /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/reputation" element={
        <ProtectedRoute>
          <Layout><Reputation /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/referrals" element={
        <ProtectedRoute>
          <Layout><Referrals /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute>
          <Layout><Profile /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/admin" element={
        <ProtectedRoute minTier={1}>
          <Layout><Admin /></Layout>
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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
