import { useMemo } from 'react'
import { BookOpen, ChevronRight, Loader2 } from 'lucide-react'
import { useCareers } from '@/hooks/useCareers'
import { useState } from 'react'

function TurnosBadge({ allowedTurnos, turnos }) {
  if (!allowedTurnos || allowedTurnos.length === 0) {
    return <span className="text-xs text-gray-400">Todos</span>
  }
  const names = turnos
    .filter(t => allowedTurnos.includes(t.id))
    .map(t => t.name.replace('Turno ', ''))
  return (
    <div className="flex flex-wrap gap-1">
      {names.map(n => (
        <span key={n} className="text-xs bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">{n}</span>
      ))}
    </div>
  )
}

export default function CareersPage({
  params,
  subjects,
  subjectsLoading,
  selectedCareerId,
  onSelectCareer,
  onSelectSubject,
}) {
  const { careers } = useCareers()
  const [search, setSearch] = useState('')

  const filteredCareers = careers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  const subjectsByYear = useMemo(() => {
    const grouped = {}
    for (const s of subjects || []) {
      if (!grouped[s.year]) grouped[s.year] = []
      grouped[s.year].push(s)
    }
    return Object.entries(grouped).sort(([a], [b]) => Number(a) - Number(b))
  }, [subjects])

  const turnos = params?.turnos || []

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Columna carreras */}
      <div className="w-64 border-r border-gray-200 flex flex-col bg-white shrink-0">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Carreras</h2>
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {filteredCareers.map(c => (
            <button
              key={c.id}
              onClick={() => onSelectCareer(c.id)}
              className={[
                'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                selectedCareerId === c.id
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100',
              ].join(' ')}
            >
              {c.name}
            </button>
          ))}
          {filteredCareers.length === 0 && (
            <p className="text-xs text-gray-400 px-3 py-4">Sin resultados</p>
          )}
        </div>
      </div>

      {/* Área materias */}
      <div className="flex-1 overflow-y-auto">
        {!selectedCareerId ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <BookOpen className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">Seleccioná una carrera</p>
          </div>
        ) : subjectsLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
          </div>
        ) : (subjects || []).length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p className="text-sm">Sin materias</p>
          </div>
        ) : (
          <div className="p-6">
            <h1 className="text-xl font-semibold text-gray-900 mb-6">
              {careers.find(c => c.id === selectedCareerId)?.name}
            </h1>
            {subjectsByYear.map(([year, subs]) => (
              <div key={year} className="mb-6">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Año {year}
                </h3>
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full">
                    <tbody>
                      {subs.map((s, i) => (
                        <tr
                          key={s.id}
                          onClick={() => onSelectSubject(s)}
                          className={[
                            'cursor-pointer transition-colors hover:bg-gray-50',
                            i > 0 ? 'border-t border-gray-100' : '',
                          ].join(' ')}
                        >
                          <td className="px-4 py-3 text-sm text-gray-900">{s.name}</td>
                          <td className="px-4 py-3">
                            <TurnosBadge allowedTurnos={s.allowed_turnos} turnos={turnos} />
                          </td>
                          <td className="px-4 py-3 w-8 text-gray-300">
                            <ChevronRight className="h-4 w-4" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
