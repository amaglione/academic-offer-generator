import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import CalendarGrid from '../components/CalendarGrid'
import CareerFilter from '../components/CareerFilter'
import CourseEditModal from '../components/CourseEditModal'

export default function OffersPage() {
  const [offer, setOffer] = useState(null)
  const [offers, setOffers] = useState([])
  const [timeSlots, setTimeSlots] = useState([])
  const [careers, setCareers] = useState([])
  const [selectedCareerIds, setSelectedCareerIds] = useState([])
  const [editingCourse, setEditingCourse] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [jobId, setJobId] = useState(null)
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)
  const { logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    client.get('/parameters').then(r => setTimeSlots(r.data.time_slots))
    loadOffers()
  }, [])

  useEffect(() => {
    if (!jobId) return
    const interval = setInterval(async () => {
      const r = await client.get(`/jobs/${jobId}`)
      if (r.data.status === 'done') {
        clearInterval(interval)
        setJobId(null)
        setGenerating(false)
        await loadOffers()
        if (r.data.offer_id) loadOffer(r.data.offer_id)
      } else if (r.data.status === 'failed') {
        clearInterval(interval)
        setJobId(null)
        setGenerating(false)
        alert('Error al generar la oferta: ' + r.data.error)
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [jobId])

  async function loadOffers() {
    const r = await client.get('/offers')
    setOffers(r.data)
    if (r.data.length > 0) loadOffer(r.data[0].id)
  }

  async function loadOffer(id) {
    const r = await client.get(`/offers/${id}`)
    setOffer(r.data)
    const careerMap = {}
    for (const course of r.data.courses) {
      if (course.career_id) careerMap[course.career_id] = course.career_name || `Carrera ${course.career_id}`
    }
    setCareers(Object.entries(careerMap).map(([id, name]) => ({ id: parseInt(id), name })))
  }

  async function handleGenerate() {
    setGenerating(true)
    setConfirmRegenerate(false)
    const r = await client.post('/generate?semester=2026-2')
    setJobId(r.data.job_id)
  }

  async function handleApprove() {
    if (!offer) return
    await client.post(`/offers/${offer.id}/approve`)
    loadOffer(offer.id)
  }

  const coursesWithYear = (offer?.courses || []).map(c => ({ ...c, year: c.year || 1 }))

  return (
    <div style={{ background: '#0f172a', minHeight: '100vh', color: '#e2e8f0' }}>
      {/* Top bar */}
      <div style={{ background: '#1e293b', borderBottom: '1px solid #334155', padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontWeight: 600 }}>Oferta Académica</span>
          {offer && (
            <span style={{ background: offer.status === 'published' ? '#166534' : '#92400e', color: offer.status === 'published' ? '#86efac' : '#fbbf24', border: `1px solid ${offer.status === 'published' ? '#16a34a' : '#b45309'}`, borderRadius: '4px', padding: '0.1rem 0.5rem', fontSize: '0.7rem' }}>
              {offer.status === 'published' ? 'PUBLICADA' : 'BORRADOR'}
            </span>
          )}
          {offer && <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{offer.semester} · {offer.courses?.length || 0} cursos</span>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <CareerFilter careers={careers} selected={selectedCareerIds} onChange={setSelectedCareerIds} />
          <button onClick={() => navigate('/parameters')} style={{ padding: '0.3rem 0.75rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '4px', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem' }}>
            Parámetros
          </button>
          {offer?.status !== 'published' && (
            <button onClick={() => setConfirmRegenerate(true)} disabled={generating} style={{ padding: '0.3rem 0.75rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '4px', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem' }}>
              {generating ? 'Generando...' : offers.length === 0 ? 'Generar oferta' : 'Regenerar'}
            </button>
          )}
          {offer?.status === 'draft' && (
            <button onClick={handleApprove} style={{ padding: '0.3rem 0.75rem', background: '#16a34a', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
              ✓ Aprobar oferta
            </button>
          )}
          <button onClick={logout} style={{ padding: '0.3rem 0.75rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '4px', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem' }}>
            Salir
          </button>
        </div>
      </div>

      {/* Calendar */}
      <div style={{ padding: '1rem' }}>
        {generating && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            <p>Ejecutando optimizador... esto puede tomar varios minutos.</p>
          </div>
        )}
        {!generating && offer && (
          <CalendarGrid
            courses={coursesWithYear}
            timeSlots={timeSlots}
            selectedCareerIds={selectedCareerIds}
            onCourseClick={offer.status === 'draft' ? setEditingCourse : () => {}}
          />
        )}
        {!generating && !offer && (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>
            <p>No hay oferta generada. Hacé clic en "Generar oferta" para comenzar.</p>
          </div>
        )}
      </div>

      {/* Regenerate confirmation */}
      {confirmRegenerate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e293b', borderRadius: '8px', padding: '1.5rem', maxWidth: '360px' }}>
            <h3 style={{ color: '#e2e8f0', marginTop: 0 }}>¿Regenerar oferta?</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Esto descartará el borrador actual y todos los ajustes manuales.</p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmRegenerate(false)} style={{ padding: '0.4rem 1rem', background: 'transparent', border: '1px solid #334155', borderRadius: '4px', color: '#94a3b8', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleGenerate} style={{ padding: '0.4rem 1rem', background: '#ef4444', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer', fontWeight: 600 }}>Regenerar</button>
            </div>
          </div>
        </div>
      )}

      {/* Course edit modal */}
      {editingCourse && (
        <CourseEditModal
          course={editingCourse}
          offerId={offer.id}
          onClose={() => setEditingCourse(null)}
          onSave={() => loadOffer(offer.id)}
        />
      )}
    </div>
  )
}
