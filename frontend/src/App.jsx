import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { Toaster } from '@/components/ui/sonner'
import AppShell from '@/components/layout/AppShell'
import LoginPage from '@/pages/LoginPage'
import OffersPage from '@/pages/OffersPage'
import ParametersPage from '@/pages/ParametersPage'
import CareersPage from '@/pages/CareersPage'
import { useParameters } from '@/hooks/useParameters'

function CareersRoute() {
  const { params } = useParameters()
  const [selectedSubject, setSelectedSubject] = useState(null)
  return (
    <CareersPage
      params={params}
      onSelectSubject={setSelectedSubject}
    />
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AppShell />}>
            <Route path="/" element={<OffersPage />} />
            <Route path="/careers" element={<CareersRoute />} />
            <Route path="/parameters" element={<ParametersPage />} />
          </Route>
        </Routes>
        <Toaster />
      </BrowserRouter>
    </AuthProvider>
  )
}
