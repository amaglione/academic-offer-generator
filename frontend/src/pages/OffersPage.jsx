import { useState } from 'react'
import { RefreshCw, Check, Loader2, AlertCircle, Download, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { useOffer } from '@/hooks/useOffer'
import { useParameters } from '@/hooks/useParameters'
import CalendarGrid from '@/components/calendar/CalendarGrid'
import CareerFilter from '@/components/shared/CareerFilter'
import StatusBadge from '@/components/shared/StatusBadge'
import CourseEditModal from '@/components/calendar/CourseEditModal'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export default function OffersPage() {
  const { offer, offers, generating, jobError, generate, approve, reopen, exportOffer, patchCourse } = useOffer()
  const { params } = useParameters()
  const [selectedCareerIds, setSelectedCareerIds] = useState([])
  const [editingCourse, setEditingCourse] = useState(null)
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)
  const [confirmReopen, setConfirmReopen] = useState(false)

  const careers = [
    ...new Map(
      (offer?.courses || [])
        .filter(c => c.career_id)
        .map(c => [c.career_id, { id: c.career_id, name: c.career_name || `Carrera ${c.career_id}` }])
    ).values(),
  ]

  const coursesWithYear = (offer?.courses || []).map(c => ({ ...c, year: c.year || 1 }))
  const timeSlots = params?.time_slots || []
  const isDraft = offer?.status === 'draft'
  const isPublished = offer?.status === 'published'
  const noOffer = !offer && !generating

  async function handleCourseDrop(courseId, newSlot) {
    const course = offer.courses.find(c => c.id === courseId)
    if (course) {
      const conflict = offer.courses.find(c =>
        c.id !== courseId &&
        c.professor_id === course.professor_id &&
        c.time_slot?.day === newSlot.day &&
        c.time_slot?.turno_id === newSlot.turno_id
      )
      if (conflict) {
        toast.error(`${course.professor_name} ya tiene un curso en esa franja`)
        return
      }

      const coursesInSlot = offer.courses.filter(c =>
        c.id !== courseId &&
        c.time_slot?.day === newSlot.day &&
        c.time_slot?.turno_id === newSlot.turno_id
      )
      if (coursesInSlot.length >= params.available_classrooms) {
        toast.error('No hay aulas disponibles en esa franja')
        return
      }
    }
    await patchCourse(courseId, { time_slot: newSlot })
    toast.success('Curso movido')
  }

  async function handleApprove() {
    await approve()
    toast.success('Oferta aprobada y publicada')
  }

  async function handleReopen() {
    setConfirmReopen(false)
    await reopen()
    toast.success('Oferta reabierta como borrador')
  }

  async function handleGenerate() {
    setConfirmRegenerate(false)
    await generate()
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-semibold text-gray-900">
            {offer ? `Oferta ${offer.semester}` : 'Calendario'}
          </h1>
          {offer && <StatusBadge status={offer.status} />}
          {offer && (
            <span className="text-sm text-gray-400">{offer.courses?.length || 0} cursos</span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <CareerFilter careers={careers} selected={selectedCareerIds} onChange={setSelectedCareerIds} />

          {noOffer && (
            <Button size="sm" onClick={handleGenerate} disabled={generating}>
              Generar oferta
            </Button>
          )}

          {offer && isDraft && (
            <Button variant="outline" size="sm" onClick={() => setConfirmRegenerate(true)} disabled={generating}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Regenerar
            </Button>
          )}

          {isDraft && (
            <Button size="sm" onClick={handleApprove} className="bg-green-600 hover:bg-green-700">
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Aprobar oferta
            </Button>
          )}

          {isPublished && (
            <>
              <Button variant="outline" size="sm" onClick={() => setConfirmReopen(true)}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Reabrir
              </Button>
              <Button variant="outline" size="sm" onClick={exportOffer}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Exportar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Error del job */}
      {jobError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Error al generar: {jobError}
        </div>
      )}

      {/* Generando */}
      {generating && (
        <div className="flex flex-col items-center justify-center py-28 text-gray-400">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400 mb-4" />
          <p className="font-medium text-gray-600">Ejecutando optimizador...</p>
          <p className="text-sm mt-1">Esto puede tardar varios minutos.</p>
        </div>
      )}

      {/* Sin oferta */}
      {noOffer && (
        <div className="flex flex-col items-center justify-center py-28 text-gray-400">
          <p className="text-lg font-medium text-gray-500">No hay oferta generada</p>
          <p className="text-sm mt-1">Hacé clic en "Generar oferta" para comenzar.</p>
        </div>
      )}

      {/* Calendario */}
      {!generating && offer && timeSlots.length > 0 && (
        <CalendarGrid
          courses={coursesWithYear}
          timeSlots={timeSlots}
          selectedCareerIds={selectedCareerIds}
          onCourseClick={isDraft ? setEditingCourse : () => {}}
          onCourseDrop={handleCourseDrop}
          draggable={isDraft}
        />
      )}

      {/* Confirm regenerar */}
      <AlertDialog open={confirmRegenerate} onOpenChange={setConfirmRegenerate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Regenerar oferta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esto descartará el borrador actual y todos los ajustes manuales. La acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleGenerate} className="bg-red-600 hover:bg-red-700">
              Regenerar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm reabrir */}
      <AlertDialog open={confirmReopen} onOpenChange={setConfirmReopen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reabrir oferta?</AlertDialogTitle>
            <AlertDialogDescription>
              La oferta volverá a estado borrador. Los cursos se mantienen tal cual están.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReopen}>
              Reabrir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal edición */}
      {editingCourse && (
        <CourseEditModal
          course={editingCourse}
          allCourses={offer.courses}
          onClose={() => setEditingCourse(null)}
          onSave={updates => patchCourse(editingCourse.id, updates)}
        />
      )}
    </div>
  )
}
