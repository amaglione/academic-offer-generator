import { useState, useEffect } from 'react'
import client from '@/api/client'

export function useCareerSubjects(careerId) {
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!careerId) { setSubjects([]); return }
    setLoading(true)
    client.get(`/careers/${careerId}/subjects`)
      .then(r => setSubjects(r.data))
      .finally(() => setLoading(false))
  }, [careerId])

  function updateSubject(updated) {
    setSubjects(prev => prev.map(s => s.id === updated.id ? updated : s))
  }

  return { subjects, loading, updateSubject }
}
