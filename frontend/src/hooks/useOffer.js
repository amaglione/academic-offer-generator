import { useState, useEffect, useCallback } from 'react'
import client from '@/api/client'

export function useOffer() {
  const [offer, setOffer] = useState(null)
  const [offers, setOffers] = useState([])
  const [generating, setGenerating] = useState(false)
  const [jobId, setJobId] = useState(null)
  const [jobError, setJobError] = useState(null)

  const loadOffer = useCallback(async (id) => {
    const r = await client.get(`/offers/${id}`)
    setOffer(r.data)
  }, [])

  const loadOffers = useCallback(async () => {
    const r = await client.get('/offers')
    setOffers(r.data)
    if (r.data.length > 0) await loadOffer(r.data[0].id)
  }, [loadOffer])

  useEffect(() => {
    loadOffers()
  }, [loadOffers])

  useEffect(() => {
    if (!jobId) return
    const interval = setInterval(async () => {
      try {
        const r = await client.get(`/jobs/${jobId}`)
        if (r.data.status === 'done') {
          clearInterval(interval)
          setJobId(null)
          setGenerating(false)
          await loadOffers()
          if (r.data.offer_id) await loadOffer(r.data.offer_id)
        } else if (r.data.status === 'failed') {
          clearInterval(interval)
          setJobId(null)
          setGenerating(false)
          setJobError(r.data.error || 'Error desconocido al generar la oferta')
        }
      } catch {
        clearInterval(interval)
        setJobId(null)
        setGenerating(false)
        setJobError('Error de conexión al verificar el estado del job')
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [jobId, loadOffers, loadOffer])

  async function generate(semester = '2026-2') {
    setJobError(null)
    setGenerating(true)
    const r = await client.post(`/generate?semester=${semester}`)
    setJobId(r.data.job_id)
  }

  async function approve() {
    if (!offer) return
    await client.post(`/offers/${offer.id}/approve`)
    await loadOffer(offer.id)
  }

  async function reopen() {
    if (!offer) return
    await client.post(`/offers/${offer.id}/reopen`)
    await loadOffer(offer.id)
  }

  async function exportOffer() {
    if (!offer) return
    const r = await client.get(`/offers/${offer.id}/export`)
    const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `oferta-${offer.semester}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function patchCourse(courseId, updates) {
    if (!offer) return
    await client.patch(`/offers/${offer.id}/courses/${courseId}`, updates)
    await loadOffer(offer.id)
  }

  return { offer, offers, generating, jobError, generate, approve, reopen, exportOffer, patchCourse }
}
