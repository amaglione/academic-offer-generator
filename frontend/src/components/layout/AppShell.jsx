import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Sidebar from './Sidebar'

export default function AppShell() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="flex bg-white min-h-screen">
      <Sidebar />
      <main className="ml-60 flex-1 min-h-screen">
        <Outlet />
      </main>
    </div>
  )
}
