import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

const YEAR_BORDER = {
  1: 'border-l-blue-500',
  2: 'border-l-green-500',
  3: 'border-l-purple-500',
  4: 'border-l-orange-500',
  5: 'border-l-red-500',
}

const YEAR_BADGE = {
  1: 'bg-blue-50 text-blue-700',
  2: 'bg-green-50 text-green-700',
  3: 'bg-purple-50 text-purple-700',
  4: 'bg-orange-50 text-orange-700',
  5: 'bg-red-50 text-red-700',
}

export default function CourseCard({ course, onClick, draggable = true }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: String(course.id),
    data: course,
    disabled: !draggable,
  })

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined
  const year = course.year || 1

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(draggable ? { ...listeners, ...attributes } : {})}
      onClick={e => { e.stopPropagation(); onClick(course) }}
      className={[
        'border-l-4',
        YEAR_BORDER[year] || YEAR_BORDER[1],
        'bg-white rounded-lg p-2 mb-1 shadow-sm transition-shadow select-none',
        isDragging ? 'opacity-50 cursor-grabbing shadow-md' : draggable ? 'cursor-grab hover:shadow-md' : 'cursor-default',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="text-xs font-semibold text-gray-800 leading-tight line-clamp-2">
          {course.subject_name}
        </span>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${YEAR_BADGE[year] || YEAR_BADGE[1]}`}>
          {year}°
        </span>
      </div>
      <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1 leading-tight">
        <span className="truncate">{course.professor_name}</span>
        <span>·</span>
        <span className="shrink-0">{course.expected_students} al.</span>
        {course.manually_modified && <span className="text-amber-500 ml-0.5">✎</span>}
      </div>
    </div>
  )
}
