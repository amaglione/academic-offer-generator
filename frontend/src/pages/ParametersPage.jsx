import { useState } from 'react'
import { Loader2, Check, Info, X, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useParameters } from '@/hooks/useParameters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const DAY_LABELS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa']

function ParamField({ label, id, value, onChange, unit }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          value={value}
          onChange={e => onChange(parseInt(e.target.value) || 0)}
          className="w-28"
          min={1}
        />
        <span className="text-sm text-gray-400">{unit}</span>
      </div>
    </div>
  )
}

function TurnosCard({ turnos, onChange }) {
  function updateTurno(index, field, value) {
    const next = turnos.map((t, i) => i === index ? { ...t, [field]: value } : t)
    onChange(next)
  }

  function toggleDay(index, day) {
    const turno = turnos[index]
    const days = turno.days.includes(day)
      ? turno.days.filter(d => d !== day)
      : [...turno.days, day].sort((a, b) => a - b)
    updateTurno(index, 'days', days)
  }

  function addTurno() {
    const newId = Date.now()
    onChange([...turnos, { id: newId, name: '', start_hour: 8, end_hour: 10, days: [0, 1, 2, 3, 4] }])
  }

  function removeTurno(index) {
    onChange(turnos.filter((_, i) => i !== index))
  }

  return (
    <Card className="md:col-span-2">
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Turnos</CardTitle>
        <CardDescription>Define las franjas horarias disponibles</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {turnos.length > 0 && (
            <div className="grid gap-1 text-xs font-medium text-gray-400 uppercase tracking-wide"
              style={{ gridTemplateColumns: '1fr 70px 70px auto auto' }}>
              <span>Nombre</span>
              <span>Inicio</span>
              <span>Fin</span>
              <span className="flex gap-1">
                {DAY_LABELS.map(d => <span key={d} className="w-6 text-center">{d}</span>)}
              </span>
              <span />
            </div>
          )}

          {turnos.map((turno, index) => (
            <div key={turno.id} className="grid items-center gap-2"
              style={{ gridTemplateColumns: '1fr 70px 70px auto auto' }}>
              <Input
                value={turno.name}
                onChange={e => updateTurno(index, 'name', e.target.value)}
                placeholder="Nombre del turno"
                className="h-8 text-sm"
              />
              <Input
                type="number"
                value={turno.start_hour}
                onChange={e => updateTurno(index, 'start_hour', parseInt(e.target.value) || 0)}
                min={0}
                max={23}
                className="h-8 text-sm w-full"
              />
              <Input
                type="number"
                value={turno.end_hour}
                onChange={e => updateTurno(index, 'end_hour', parseInt(e.target.value) || 0)}
                min={1}
                max={24}
                className="h-8 text-sm w-full"
              />
              <div className="flex gap-1">
                {DAY_LABELS.map((label, day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(index, day)}
                    className={[
                      'w-6 h-6 rounded text-xs font-medium transition-colors',
                      turno.days.includes(day)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => removeTurno(index)}
                className="text-gray-300 hover:text-red-500 transition-colors p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addTurno}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 mt-2"
          >
            <Plus className="h-4 w-4" />
            Agregar turno
          </button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function ParametersPage() {
  const { params, setParams, saving, save } = useParameters()
  const [saved, setSaved] = useState(false)

  if (!params) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
      </div>
    )
  }

  function update(key, value) {
    setParams(p => ({ ...p, [key]: value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    const { max_students_per_course, max_weekly_hours_per_professor, available_classrooms, solver_timeout_seconds, turnos } = params
    await save({ max_students_per_course, max_weekly_hours_per_professor, available_classrooms, solver_timeout_seconds, turnos })
    setSaved(true)
    toast.success('Parámetros guardados correctamente')
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Parámetros del optimizador</h1>

      <form onSubmit={handleSave}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Capacidad</CardTitle>
              <CardDescription>Límites de alumnos, aulas y carga docente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ParamField label="Alumnos por curso" id="max_students_per_course" value={params.max_students_per_course} onChange={v => update('max_students_per_course', v)} unit="alumnos" />
              <ParamField label="Aulas disponibles" id="available_classrooms" value={params.available_classrooms} onChange={v => update('available_classrooms', v)} unit="aulas" />
              <ParamField label="Hs. semanales por docente" id="max_weekly_hours_per_professor" value={params.max_weekly_hours_per_professor} onChange={v => update('max_weekly_hours_per_professor', v)} unit="horas" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Solver</CardTitle>
              <CardDescription>Configuración del optimizador CP-SAT</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ParamField label="Timeout" id="solver_timeout_seconds" value={params.solver_timeout_seconds} onChange={v => update('solver_timeout_seconds', v)} unit="segundos" />
              <div className="flex gap-2 rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-700">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <p>Si se alcanza el timeout, el solver devuelve la mejor solución encontrada hasta ese momento.</p>
              </div>
            </CardContent>
          </Card>

          <TurnosCard turnos={params.turnos || []} onChange={v => update('turnos', v)} />
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="min-w-36">
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</>
            ) : saved ? (
              <><Check className="h-4 w-4 mr-2" />Guardado</>
            ) : 'Guardar cambios'}
          </Button>
        </div>
      </form>
    </div>
  )
}
