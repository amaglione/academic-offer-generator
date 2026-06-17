const YEAR_COLORS = {
  1: { bg: '#1e3a5f', border: '#3b82f6', text: '#93c5fd' },
  2: { bg: '#1a3a2a', border: '#22c55e', text: '#86efac' },
  3: { bg: '#2d1b4e', border: '#a855f7', text: '#d8b4fe' },
  4: { bg: '#3b2a1a', border: '#f97316', text: '#fdba74' },
  5: { bg: '#3b1f1f', border: '#ef4444', text: '#fca5a5' },
}

export default function CourseCard({ course, onClick }) {
  const colors = YEAR_COLORS[course.year] || YEAR_COLORS[1]
  return (
    <div
      onClick={() => onClick(course)}
      style={{
        background: colors.bg,
        borderLeft: `3px solid ${colors.border}`,
        borderRadius: '4px',
        padding: '0.3rem 0.4rem',
        marginBottom: '0.2rem',
        cursor: 'pointer',
        opacity: course.manually_modified ? 0.8 : 1,
      }}
    >
      <div style={{ color: colors.text, fontWeight: 600, fontSize: '0.75rem' }}>
        {course.subject_name}
        {course.manually_modified && ' ✎'}
      </div>
      <div style={{ color: '#64748b', fontSize: '0.65rem' }}>
        {course.professor_name} · {course.expected_students} alumnos
      </div>
    </div>
  )
}
