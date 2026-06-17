import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { Toaster } from '@/components/ui/sonner'
import AppShell from '@/components/layout/AppShell'
import LoginPage from '@/pages/LoginPage'
import OffersPage from '@/pages/OffersPage'
import ParametersPage from '@/pages/ParametersPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AppShell />}>
            <Route path="/" element={<OffersPage />} />
            <Route path="/parameters" element={<ParametersPage />} />
          </Route>
        </Routes>
        <Toaster />
      </BrowserRouter>
    </AuthProvider>
  )
}
