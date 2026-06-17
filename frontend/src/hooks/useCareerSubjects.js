import { useState, useEffect } from 'react'
import client from '@/api/client'

export function useCareerSubjects(careerId) {
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!careerId) { setSubjects([]); setError(null); return }
    setLoading(true)
    setError(null)
    client.get(`/careers/${careerId}/subjects`)
      .then(r => setSubjects(r.data))
      .catch(() => setError('Error al cargar las materias'))
      .finally(() => setLoading(false))
  }, [careerId])

  function updateSubject(updated) {
    setSubjects(prev => prev.map(s => s.id === updated.id ? updated : s))
  }

  return { subjects, loading, error, updateSubject }
}
