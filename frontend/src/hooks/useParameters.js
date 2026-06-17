import { useState, useEffect } from 'react'
import client from '@/api/client'

export function useParameters() {
  const [params, setParams] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    client.get('/parameters').then(r => setParams(r.data))
  }, [])

  async function save(updates) {
    setSaving(true)
    try {
      const r = await client.put('/parameters', updates)
      setParams(r.data)
    } finally {
      setSaving(false)
    }
  }

  return { params, setParams, saving, save }
}
