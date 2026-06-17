import { createContext, useContext, useState } from 'react'
import { setToken, clearToken, STORAGE_KEY } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY)
      return s ? { username: JSON.parse(s).username } : null
    } catch { return null }
  })

  function login(token, username) {
    setToken(token)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, username })) } catch {}
    setUser({ username })
  }

  function logout() {
    clearToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }
