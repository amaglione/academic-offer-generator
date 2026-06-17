import { useState } from 'react'
import { Loader2, Check, Info } from 'lucide-react'
import { toast } from 'sonner'
import { useParameters } from '@/hooks/useParameters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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
    const { max_students_per_course, max_weekly_hours_per_professor, available_classrooms, solver_timeout_seconds } = params
    await save({ max_students_per_course, max_weekly_hours_per_professor, available_classrooms, solver_timeout_seconds })
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
