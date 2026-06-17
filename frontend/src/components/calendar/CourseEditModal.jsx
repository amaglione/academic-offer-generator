import { useState } from 'react'
import { Clock } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export default function CourseEditModal({ course, allCourses, onClose, onSave }) {
  const [professorId, setProfessorId] = useState(course.professor_id)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (professorId !== course.professor_id) {
      const conflict = (allCourses || []).find(c =>
        c.id !== course.id &&
        c.professor_id === professorId &&
        c.time_slot?.day === course.time_slot?.day &&
        c.time_slot?.turno_id === course.time_slot?.turno_id
      )
      if (conflict) {
        setError('Este docente ya tiene un curso en esta franja horaria')
        return
      }
    }
    setError(null)
    setSaving(true)
    await onSave({ professor_id: professorId })
    setSaving(false)
    onClose()
  }

  const slot = course.time_slot
  const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-6">{course.subject_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {slot && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="h-4 w-4 text-gray-400 shrink-0" />
              {dayNames[slot.day] ?? slot.day_name} · {slot.start_hour}:00 – {slot.end_hour ?? slot.start_hour + 2}:00
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Docente</label>
            <select
              value={professorId}
              onChange={e => { setProfessorId(Number(e.target.value)); setError(null) }}
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {(course.eligible_professors || []).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
