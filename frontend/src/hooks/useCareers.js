import { useState, useEffect } from 'react'
import client from '@/api/client'

export function useCareers() {
  const [careers, setCareers] = useState([])

  useEffect(() => {
    client.get('/careers').then(r => setCareers(r.data))
  }, [])

  return { careers }
}
