import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import client from '../api/client'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      const r = await client.post('/auth/login', { username, password })
      login(r.data.access_token, username)
      navigate('/')
    } catch {
      setError('Usuario o contraseña incorrectos')
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#0f172a' }}>
      <form onSubmit={handleSubmit} style={{ background: '#1e293b', padding: '2rem', borderRadius: '8px', minWidth: '320px' }}>
        <h2 style={{ color: '#e2e8f0', marginTop: 0 }}>Oferta Académica</h2>
        {error && <p style={{ color: '#f87171' }}>{error}</p>}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>Usuario</label>
          <input
            value={username} onChange={e => setUsername(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#e2e8f0', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>Contraseña</label>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#e2e8f0', boxSizing: 'border-box' }}
          />
        </div>
        <button type="submit" style={{ width: '100%', padding: '0.6rem', background: '#3b82f6', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
          Ingresar
        </button>
      </form>
    </div>
  )
}
