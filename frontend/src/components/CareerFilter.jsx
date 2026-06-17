import { useState, useRef, useEffect } from 'react'

export default function CareerFilter({ careers, selected, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  }

  const label = selected.length === 0 || selected.length === careers.length
    ? 'Todas las carreras'
    : `${selected.length} carrera${selected.length > 1 ? 's' : ''} seleccionada${selected.length > 1 ? 's' : ''}`

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ background: '#0f172a', border: '1px solid #475569', borderRadius: '6px', padding: '0.3rem 2rem 0.3rem 0.75rem', color: '#e2e8f0', cursor: 'pointer', minWidth: '200px', textAlign: 'left', position: 'relative', fontSize: '0.85rem' }}
      >
        {label}
        <span style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>▼</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, background: '#1e293b', border: '1px solid #475569', borderRadius: '6px', padding: '0.4rem', minWidth: '240px', zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          {careers.map(career => (
            <div
              key={career.id}
              onClick={() => toggle(career.id)}
              style={{ padding: '0.35rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '4px', cursor: 'pointer', background: selected.includes(career.id) ? '#0f172a' : 'transparent' }}
            >
              <span style={{ width: 14, height: 14, background: selected.includes(career.id) ? '#3b82f6' : 'transparent', border: selected.includes(career.id) ? 'none' : '1px solid #475569', borderRadius: '3px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.65rem', flexShrink: 0 }}>
                {selected.includes(career.id) ? '✓' : ''}
              </span>
              <span style={{ color: selected.includes(career.id) ? '#e2e8f0' : '#94a3b8', fontSize: '0.85rem' }}>{career.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
