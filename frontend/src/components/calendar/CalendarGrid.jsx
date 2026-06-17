import { useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import CourseCard from './CourseCard'
import SlotCell from './SlotCell'

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']

export default function CalendarGrid({ courses, timeSlots, selectedCareerIds, onCourseClick, onCourseDrop, draggable }) {
  const [activeCourse, setActiveCourse] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const filtered = selectedCareerIds.length === 0
    ? courses
    : courses.filter(c => selectedCareerIds.includes(c.career_id))

  const bySlot = {}
  for (const c of filtered) {
    const key = `${c.time_slot?.day}-${c.time_slot?.start_hour}`
    if (!bySlot[key]) bySlot[key] = []
    bySlot[key].push(c)
  }

  const uniqueHours = [...new Set(timeSlots.map(s => s.start_hour))].sort((a, b) => a - b)

  function handleDragStart(e) {
    setActiveCourse(e.active.data.current)
  }

  function handleDragEnd(e) {
    setActiveCourse(null)
    const { active, over } = e
    if (!over) return
    const [dayStr, hourStr] = over.id.split('-')
    const day = parseInt(dayStr)
    const startHour = parseInt(hourStr)
    const course = active.data.current
    if (day === course.time_slot?.day && startHour === course.time_slot?.start_hour) return
    const slot = timeSlots.find(s => s.day === day && s.start_hour === startHour)
    if (slot) onCourseDrop(course.id, slot)
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-16 p-3 border-r border-gray-200" />
              {DAY_NAMES.map(d => (
                <th key={d} className="p-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {uniqueHours.map(startHour => (
              <tr key={startHour} className="border-t border-gray-100">
                <td className="p-2 text-right text-xs font-medium text-gray-400 border-r border-gray-200 align-top whitespace-nowrap">
                  {startHour}:00
                </td>
                {[0, 1, 2, 3, 4].map(day => (
                  <SlotCell key={day} day={day} startHour={startHour}>
                    {(bySlot[`${day}-${startHour}`] || []).map(course => (
                      <CourseCard
                        key={course.id}
                        course={course}
                        onClick={onCourseClick}
                        draggable={draggable}
                      />
                    ))}
                  </SlotCell>
                ))}
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
