import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import client from '@/api/client'
import { Button } from '@/components/ui/button'

export default function SubjectPanel({ subject, turnos, onClose, onUpdate }) {
  const [checked, setChecked] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!subject) return
    if (subject.allowed_turnos === null || subject.allowed_turnos === undefined) {
      setChecked(turnos.map(t => t.id))
    } else {
      setChecked(subject.allowed_turnos)
    }
  }, [subject, turnos])

  function toggle(turnoId) {
    setChecked(prev =>
      prev.includes(turnoId) ? prev.filter(id => id !== turnoId) : [...prev, turnoId]
    )
  }

  async function handleSave() {
    setSaving(true)
    const allChecked = checked.length === turnos.length
    const payload = { allowed_turnos: allChecked ? null : checked }
    try {
      const r = await client.patch(`/careers/subjects/${subject.id}/turnos`, payload)
      onUpdate(r.data)
      toast.success('Turnos guardados')
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (!subject) return null

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-xl border-l border-gray-200 z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900 text-sm truncate pr-2">{subject.name}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Docentes</h3>
          {subject.professors.length === 0 ? (
            <p className="text-sm text-gray-400">Sin docentes asignados</p>
          ) : (
            <ul className="space-y-1.5">
              {subject.professors.map(p => (
                <li key={p.id} className="text-sm text-gray-700">{p.name}</li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Turnos habilitados</h3>
          {turnos.length === 0 ? (
            <p className="text-sm text-gray-400">No hay turnos configurados</p>
          ) : (
            <div className="space-y-2">
              {turnos.map(t => (
                <label key={t.id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked.includes(t.id)}
                    onChange={() => toggle(t.id)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm text-gray-700">{t.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{t.start_hour}:00–{t.end_hour}:00</span>
                  </div>
                </label>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="p-4 border-t border-gray-200">
        <Button onClick={handleSave} disabled={saving || checked.length === 0} className="w-full">
          {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</> : 'Guardar'}
        </Button>
        {checked.length === 0 && (
          <p className="text-xs text-red-500 mt-2 text-center">Seleccioná al menos un turno</p>
        )}
      </div>
    </div>
  )
}
