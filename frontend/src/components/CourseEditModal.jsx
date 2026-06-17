import { useEffect, useState } from 'react'
import client from '../api/client'

export default function CourseEditModal({ course, offerId, onClose, onSave }) {
  const [professors, setProfessors] = useState([])
  const [profId, setProfId] = useState(course.professor_id)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setProfessors([{ id: course.professor_id, name: course.professor_name }])
  }, [course])

  async function handleSave() {
    setSaving(true)
    await client.patch(`/offers/${offerId}/courses/${course.id}`, { professor_id: profId })
    setSaving(false)
    onSave()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#1e293b', borderRadius: '8px', padding: '1.5rem', minWidth: '320px' }}>
        <h3 style={{ color: '#e2e8f0', marginTop: 0 }}>{course.subject_name}</h3>
        <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 1rem' }}>
          {course.time_slot?.day_name} {course.time_slot?.start_hour}:00 - {course.time_slot?.end_hour}:00
        </p>
        <label style={{ color: '#94a3b8', display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>Docente</label>
        <select
          value={profId}
          onChange={e => setProfId(parseInt(e.target.value))}
          style={{ width: '100%', padding: '0.4rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#e2e8f0', marginBottom: '1rem' }}
        >
          {professors.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.4rem 1rem', background: 'transparent', border: '1px solid #334155', borderRadius: '4px', color: '#94a3b8', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '0.4rem 1rem', background: '#3b82f6', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
