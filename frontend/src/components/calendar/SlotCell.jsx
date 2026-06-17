import { useDroppable } from '@dnd-kit/core'

export default function SlotCell({ day, startHour, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${day}-${startHour}` })

  return (
    <td
      ref={setNodeRef}
      className={[
        'align-top p-1.5 border-r border-gray-100 min-w-[130px] transition-colors',
        isOver ? 'bg-blue-50 ring-2 ring-blue-300 ring-inset rounded' : '',
      ].join(' ')}
    >
      {children}
    </td>
  )
}
