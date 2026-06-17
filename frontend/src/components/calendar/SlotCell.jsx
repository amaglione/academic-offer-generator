import { useDroppable } from '@dnd-kit/core'

export default function SlotCell({ turnoId, day, children, disabled }) {
  const id = `${turnoId}-${day}`
  const { setNodeRef, isOver } = useDroppable({ id, disabled })

  return (
    <td
      ref={setNodeRef}
      className={[
        'align-top p-1.5 border-r border-gray-100 min-w-[130px] transition-colors',
        disabled ? 'bg-gray-50' : '',
        isOver && !disabled ? 'bg-blue-50 ring-2 ring-blue-300 ring-inset rounded' : '',
      ].join(' ')}
    >
      {children}
    </td>
  )
}
