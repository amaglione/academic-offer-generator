import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function ParametersPage() {
  const [params, setParams] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const { logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    client.get('/parameters').then(r => setParams(r.data))
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const { max_students_per_course, max_weekly_hours_per_professor, available_classrooms, solver_timeout_seconds } = params
    await client.put('/parameters', { max_students_per_course, max_weekly_hours_per_professor, available_classrooms, solver_timeout_seconds })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!params) return <p style={{ color: '#94a3b8', padding: '2rem' }}>Cargando...</p>

  const field = (label, key, unit = '') => (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input
          type="number"
          value={params[key]}
          onChange={e => setParams(p => ({ ...p, [key]: parseInt(e.target.value) }))}
          style={{ padding: '0.4rem 0.6rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#e2e8f0', width: '120px' }}
        />
        {unit && <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{unit}</span>}
      </div>
    </div>
  )

  return (
    <div style={{ background: '#0f172a', minHeight: '100vh', padding: '2rem', color: '#e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>Parámetros del optimizador</h2>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => navigate('/')} style={{ padding: '0.4rem 1rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '4px', color: '#94a3b8', cursor: 'pointer' }}>
            ← Volver
          </button>
          <button onClick={logout} style={{ padding: '0.4rem 1rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '4px', color: '#94a3b8', cursor: 'pointer' }}>
            Salir
          </button>
        </div>
      </div>
      <form onSubmit={handleSave} style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', maxWidth: '480px' }}>
        {field('Máximo de alumnos por curso', 'max_students_per_course', 'alumnos')}
        {field('Máximo de horas semanales por docente', 'max_weekly_hours_per_professor', 'horas')}
        {field('Aulas disponibles', 'available_classrooms', 'aulas')}
        {field('Timeout del solver', 'solver_timeout_seconds', 'segundos')}
        <button type="submit" disabled={saving} style={{ padding: '0.5rem 1.5rem', background: '#3b82f6', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
          {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar'}
        </button>
      </form>
    </div>
  )
}
