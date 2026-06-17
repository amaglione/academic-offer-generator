from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models.tenant import User
from app.models.academic import Career, Subject, Professor, ProfessorSubject
from app.schemas.careers import CareerResponse, SubjectResponse, ProfessorInSubject, SubjectTurnosUpdate

router = APIRouter()


@router.get("", response_model=list[CareerResponse])
def list_careers(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    careers = db.query(Career).filter(Career.tenant_id == current_user.tenant_id).order_by(Career.name).all()
    return [CareerResponse(id=c.id, name=c.name) for c in careers]


@router.get("/{career_id}/subjects", response_model=list[SubjectResponse])
def list_subjects(career_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    career = db.query(Career).filter(
        Career.id == career_id,
        Career.tenant_id == current_user.tenant_id
    ).first()
    if not career:
        raise HTTPException(status_code=404, detail="Career not found")

    subjects = (
        db.query(Subject)
        .filter(Subject.career_id == career_id, Subject.tenant_id == current_user.tenant_id)
        .order_by(Subject.year, Subject.name)
        .all()
    )

    result = []
    for s in subjects:
        professors = (
            db.query(Professor)
            .join(ProfessorSubject, ProfessorSubject.professor_id == Professor.id)
            .filter(ProfessorSubject.subject_id == s.id)
            .order_by(Professor.name)
            .all()
        )
        result.append(SubjectResponse(
            id=s.id,
            name=s.name,
            year=s.year,
            allowed_turnos=s.allowed_turnos,
            professors=[ProfessorInSubject(id=p.id, name=p.name) for p in professors],
        ))
    return result


@router.patch("/subjects/{subject_id}/turnos", response_model=SubjectResponse)
def update_subject_turnos(
    subject_id: int,
    body: SubjectTurnosUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    subject = db.query(Subject).filter(
        Subject.id == subject_id,
        Subject.tenant_id == current_user.tenant_id
    ).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    subject.allowed_turnos = body.allowed_turnos
    db.commit()
    db.refresh(subject)

    professors = (
        db.query(Professor)
        .join(ProfessorSubject, ProfessorSubject.professor_id == Professor.id)
        .filter(ProfessorSubject.subject_id == subject.id)
        .order_by(Professor.name)
        .all()
    )
    return SubjectResponse(
        id=subject.id,
        name=subject.name,
        year=subject.year,
        allowed_turnos=subject.allowed_turnos,
        professors=[ProfessorInSubject(id=p.id, name=p.name) for p in professors],
    )
