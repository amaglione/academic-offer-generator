import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function CareerFilter({ careers, selected, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  }

  const label =
    selected.length === 0 || selected.length === careers.length
      ? 'Todas las carreras'
      : `${selected.length} carrera${selected.length > 1 ? 's' : ''}`

  return (
    <div ref={ref} className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(o => !o)}
        className="gap-2 min-w-44 justify-between"
      >
        <span>{label}</span>
        <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
      </Button>

      {open && (
        <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-52 z-50">
          {careers.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-400">Sin carreras disponibles</p>
          )}
          {careers.map(career => (
            <button
              key={career.id}
              onClick={() => toggle(career.id)}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 text-left transition-colors"
            >
              <div
                className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  selected.includes(career.id)
                    ? 'bg-blue-600 border-blue-600'
                    : 'border-gray-300 bg-white'
                }`}
              >
                {selected.includes(career.id) && <Check className="h-3 w-3 text-white" />}
              </div>
              <span className="text-gray-700">{career.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
