import { useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import CourseCard from './CourseCard'
import SlotCell from './SlotCell'

const ALL_DAYS = [
  { index: 0, name: 'Lunes' },
  { index: 1, name: 'Martes' },
  { index: 2, name: 'Miércoles' },
  { index: 3, name: 'Jueves' },
  { index: 4, name: 'Viernes' },
  { index: 5, name: 'Sábado' },
]

export default function CalendarGrid({ courses, timeSlots, selectedCareerIds, onCourseClick, onCourseDrop, draggable }) {
  const [activeCourse, setActiveCourse] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const filtered = selectedCareerIds.length === 0
    ? courses
    : courses.filter(c => selectedCareerIds.includes(c.career_id))

  // Index courses by turno_id-day key
  const bySlot = {}
  for (const c of filtered) {
    const key = `${c.time_slot?.turno_id}-${c.time_slot?.day}`
    if (!bySlot[key]) bySlot[key] = []
    bySlot[key].push(c)
  }

  // Unique turnos preserving order
  const seenTurnos = new Set()
  const uniqueTurnos = []
  for (const slot of timeSlots) {
    if (!seenTurnos.has(slot.turno_id)) {
      seenTurnos.add(slot.turno_id)
      uniqueTurnos.push({ id: slot.turno_id, name: slot.turno_name, start_hour: slot.start_hour, end_hour: slot.end_hour })
    }
  }

  // Days that appear in at least one slot
  const enabledDays = new Set(timeSlots.map(s => s.day))
  const visibleDays = ALL_DAYS.filter(d => enabledDays.has(d.index))

  function handleDragStart(e) {
    setActiveCourse(e.active.data.current)
  }

  function handleDragEnd(e) {
    setActiveCourse(null)
    const { active, over } = e
    if (!over) return
    const [turnoIdStr, dayStr] = over.id.split('-')
    const turnoId = parseInt(turnoIdStr)
    const day = parseInt(dayStr)
    const course = active.data.current
    if (turnoId === course.time_slot?.turno_id && day === course.time_slot?.day) return
    const slot = timeSlots.find(s => s.turno_id === turnoId && s.day === day)
    if (slot) onCourseDrop(course.id, slot)
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-36 p-3 border-r border-gray-200" />
              {visibleDays.map(d => (
                <th key={d.index} className="p-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">
                  {d.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {uniqueTurnos.map(turno => (
              <tr key={turno.id} className="border-t border-gray-100">
                <td className="p-2 text-right border-r border-gray-200 align-top">
                  <span className="text-xs font-medium text-gray-600 block">{turno.name}</span>
                  <span className="text-xs text-gray-400">{turno.start_hour}:00–{turno.end_hour}:00</span>
                </td>
                {visibleDays.map(d => {
                  const slotExists = timeSlots.some(s => s.turno_id === turno.id && s.day === d.index)
                  return (
                    <SlotCell key={d.index} turnoId={turno.id} day={d.index} disabled={!slotExists || !draggable}>
                      {(bySlot[`${turno.id}-${d.index}`] || []).map(course => (
                        <CourseCard
                          key={course.id}
                          course={course}
                          onClick={onCourseClick}
                          draggable={draggable && slotExists}
                        />
                      ))}
                    </SlotCell>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DragOverlay>
        {activeCourse && (
          <CourseCard course={activeCourse} onClick={() => {}} draggable={false} />
        )}
      </DragOverlay>
    </DndContext>
  )
}
