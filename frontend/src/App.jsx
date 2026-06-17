import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { Toaster } from '@/components/ui/sonner'
import AppShell from '@/components/layout/AppShell'
import LoginPage from '@/pages/LoginPage'
import OffersPage from '@/pages/OffersPage'
import ParametersPage from '@/pages/ParametersPage'
import CareersPage from '@/pages/CareersPage'
import SubjectPanel from '@/components/careers/SubjectPanel'
import { useParameters } from '@/hooks/useParameters'
import { useCareerSubjects } from '@/hooks/useCareerSubjects'

function CareersRoute() {
  const { params } = useParameters()
  const [selectedCareerId, setSelectedCareerId] = useState(null)
  const [selectedSubject, setSelectedSubject] = useState(null)
  const { subjects, loading, updateSubject } = useCareerSubjects(selectedCareerId)

  return (
    <>
      <CareersPage
        params={params}
        subjects={subjects}
        subjectsLoading={loading}
        selectedCareerId={selectedCareerId}
        onSelectCareer={id => { setSelectedCareerId(id); setSelectedSubject(null) }}
        onSelectSubject={setSelectedSubject}
      />
      {selectedSubject && (
        <SubjectPanel
          subject={subjects.find(s => s.id === selectedSubject.id) ?? selectedSubject}
          turnos={params?.turnos || []}
          onClose={() => setSelectedSubject(null)}
          onUpdate={updated => updateSubject(updated)}
        />
      )}
    </>
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
