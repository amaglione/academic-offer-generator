import { useState } from 'react'
import { Clock, User } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export default function CourseEditModal({ course, onClose, onSave }) {
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSave({ professor_id: course.professor_id })
    setSaving(false)
    onClose()
  }

  const slot = course.time_slot
  const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-6">{course.subject_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {slot && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="h-4 w-4 text-gray-400 shrink-0" />
              {dayNames[slot.day] || slot.day_name} · {slot.start_hour}:00 – {slot.end_hour || slot.start_hour + 1}:00
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <User className="h-4 w-4 text-gray-400 shrink-0" />
            {course.professor_name}
          </div>
          <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
            Para cambiar la franja horaria, arrastrá el curso en el calendario. Guardar aquí marca el curso como modificado manualmente.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Marcar editado'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
