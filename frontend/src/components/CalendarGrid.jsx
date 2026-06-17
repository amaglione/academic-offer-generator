import CourseCard from './CourseCard'

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']

export default function CalendarGrid({ courses, timeSlots, selectedCareerIds, onCourseClick }) {
  const filteredCourses = selectedCareerIds.length === 0
    ? courses
    : courses.filter(c => selectedCareerIds.includes(c.career_id))

  const coursesBySlot = {}
  for (const course of filteredCourses) {
    const key = `${course.time_slot?.day}-${course.time_slot?.start_hour}`
    if (!coursesBySlot[key]) coursesBySlot[key] = []
    coursesBySlot[key].push(course)
  }

  const uniqueHours = [...new Set(timeSlots.map(s => s.start_hour))].sort((a, b) => a - b)

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
        <thead>
          <tr style={{ background: '#1e293b' }}>
            <th style={{ padding: '0.5rem', color: '#64748b', width: '60px', borderRight: '1px solid #334155' }}></th>
            {DAY_NAMES.map(d => (
              <th key={d} style={{ padding: '0.5rem', color: '#94a3b8', fontWeight: 600, borderRight: '1px solid #334155' }}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {uniqueHours.map(startHour => (
            <tr key={startHour} style={{ borderTop: '1px solid #1e293b' }}>
              <td style={{ padding: '0.4rem 0.5rem', color: '#475569', textAlign: 'right', borderRight: '1px solid #334155', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                {startHour}:00
              </td>
              {[0, 1, 2, 3, 4].map(day => {
                const key = `${day}-${startHour}`
                const slotCourses = coursesBySlot[key] || []
                return (
                  <td key={day} style={{ padding: '0.3rem', borderRight: '1px solid #1e293b', verticalAlign: 'top', minWidth: '120px' }}>
                    {slotCourses.map(course => (
                      <CourseCard key={course.id} course={course} onClick={onCourseClick} />
                    ))}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
