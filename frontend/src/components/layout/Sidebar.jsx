import { NavLink } from 'react-router-dom'
import { Calendar, Settings, GraduationCap, BookOpen } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'

export default function Sidebar() {
  const { user, logout } = useAuth()

  const navItem = (to, Icon, label) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
        }`
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </NavLink>
  )

  return (
    <div className="w-60 h-screen bg-gray-50 border-r border-gray-200 flex flex-col fixed left-0 top-0 z-40">
      <div className="p-5 border-b border-gray-200">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <GraduationCap className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-gray-900 text-sm">Oferta Académica</span>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItem('/', Calendar, 'Calendario')}
        {navItem('/careers', BookOpen, 'Carreras')}
        {navItem('/parameters', Settings, 'Parámetros')}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <p className="text-xs text-gray-400 truncate mb-2">{user?.username}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="w-full justify-start text-gray-500 hover:text-gray-700 px-2"
        >
          Cerrar sesión
        </Button>
      </div>
    </div>
  )
}
