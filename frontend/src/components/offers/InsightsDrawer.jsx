import { X, AlertCircle, AlertTriangle } from 'lucide-react'

const SEVERITY_ICONS = {
  error: <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />,
}

function AlertItem({ insight }) {
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
      <div className="flex gap-2.5">
        {SEVERITY_ICONS[insight.severity]}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800">{insight.title}</p>
          {insight.value && <p className="text-xs text-gray-500 mt-0.5">{insight.value}</p>}

          {insight.key === 'unassigned_subjects' && insight.items?.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {insight.items.map((item, i) => (
                <div key={i} className="flex items-center text-xs text-gray-600 gap-1.5">
                  <span className="flex-1 truncate">{item.name}</span>
                  <span className="text-gray-400 shrink-0">{item.demand} alumnos</span>
                  <span className="text-gray-300">·</span>
                  <span className="text-gray-400 shrink-0">
                    {item.reason}
                  </span>
                </div>
              ))}
            </div>
          )}

          {insight.key === 'professor_overload' && insight.items?.length > 0 && (
            <div className="mt-2 space-y-2">
              {insight.items.map((item, i) => (
                <div key={i} className="text-xs text-gray-600">
                  <div className="flex justify-between mb-0.5">
                    <span className="truncate">{item.name}</span>
                    <span className="text-gray-400 shrink-0 ml-2">
                      {item.hours_assigned}h / {item.hours_limit}h
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full"
                      style={{ width: `${Math.min(100, (item.hours_assigned / item.hours_limit) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatItem({ insight }) {
  if (insight.key === 'courses_assigned') {
    return (
      <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
        <p className="text-xs text-gray-400 uppercase tracking-wide">{insight.title}</p>
        <p className="text-2xl font-semibold text-gray-900 mt-1">{insight.value}</p>
      </div>
    )
  }
  if (insight.key === 'slot_distribution') {
    return (
      <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">{insight.title}</p>
        <div className="space-y-1">
          {(insight.items ?? []).map((item, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{item.name}</span>
              <span className="font-medium text-gray-800">{item.count}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (insight.key === 'classroom_peak') {
    const item = insight.items?.[0] ?? { peak: 0, limit: 0 }
    const pct = item.limit > 0 ? Math.round((item.peak / item.limit) * 100) : 0
    const isCritical = pct > 80
    return (
      <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">{insight.title}</p>
        <div className="flex items-end gap-2">
          <span className={`text-2xl font-semibold ${isCritical ? 'text-amber-600' : 'text-gray-900'}`}>
            {item.peak}
          </span>
          <span className="text-sm text-gray-400 mb-0.5">/ {item.limit} aulas ({pct}%)</span>
        </div>
      </div>
    )
  }
  return null
}

export default function InsightsDrawer({ insights, onClose }) {
  const alerts = (insights ?? [])
    .filter(i => i.type === 'alert')
    .sort((a, b) => {
      const order = { error: 0, warning: 1, info: 2 }
      return (order[a.severity] ?? 3) - (order[b.severity] ?? 3)
    })
  const stats = (insights ?? []).filter(i => i.type === 'stat')

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-xl border-l border-gray-200 z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 shrink-0">
        <h2 className="text-sm font-semibold text-gray-900">Resumen de la oferta</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded p-0.5">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {!insights ? (
          <p className="text-sm text-gray-400 text-center py-8">Sin datos de análisis disponibles</p>
        ) : (
          <>
            {alerts.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Alertas
                </h3>
                <div className="space-y-2">
                  {alerts.map((insight, i) => <AlertItem key={i} insight={insight} />)}
                </div>
              </section>
            )}

            {stats.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Estadísticas
                </h3>
                <div className="space-y-2">
                  {stats.map((insight, i) => <StatItem key={i} insight={insight} />)}
                </div>
              </section>
            )}

            {alerts.length === 0 && stats.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">Sin datos de análisis disponibles</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
