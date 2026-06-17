from sqlalchemy.orm import Session
from app.models.academic import Career, Subject, Prerequisite, Professor, ProfessorSubject, Student, AcademicHistory


def get_subjects(db: Session, tenant_id: int) -> list[dict]:
    subjects = db.query(Subject).filter(Subject.tenant_id == tenant_id).all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "year": s.year,
            "career_id": s.career_id,
            "allowed_turnos": s.allowed_turnos,
        }
        for s in subjects
    ]


def get_prerequisites(db: Session) -> dict[int, list[int]]:
    """Returns {subject_id: [required_subject_id, ...]}"""
    prereqs = db.query(Prerequisite).all()
    result: dict[int, list[int]] = {}
    for p in prereqs:
        result.setdefault(p.subject_id, []).append(p.requires_subject_id)
    return result


def get_professors(db: Session, tenant_id: int) -> list[dict]:
    profs = db.query(Professor).filter(Professor.tenant_id == tenant_id).all()
    return [{"id": p.id, "name": p.name} for p in profs]


def get_professor_subjects(db: Session) -> dict[int, list[int]]:
    """Returns {subject_id: [professor_id, ...]}"""
    rows = db.query(ProfessorSubject).all()
    result: dict[int, list[int]] = {}
    for row in rows:
        result.setdefault(row.subject_id, []).append(row.professor_id)
    return result


def get_students_with_history(db: Session, tenant_id: int) -> list[dict]:
    """Returns [{id, career_id, passed_subject_ids: set}]"""
    students = db.query(Student).filter(Student.tenant_id == tenant_id).all()
    history = db.query(AcademicHistory).filter(AcademicHistory.passed == True).all()
    passed_by_student: dict[int, set[int]] = {}
    for h in history:
        passed_by_student.setdefault(h.student_id, set()).add(h.subject_id)
    return [
        {"id": s.id, "career_id": s.career_id, "passed_subject_ids": passed_by_student.get(s.id, set())}
        for s in students
    ]
