from app.models.academic import Subject, Professor, ProfessorSubject


def test_subject_allowed_turnos_defaults_null(db):
    subject = Subject(id=10, tenant_id=1, career_id=1, name="Álgebra", year=1)
    db.add(subject)
    db.commit()
    db.refresh(subject)
    assert subject.allowed_turnos is None


def test_subject_allowed_turnos_persists(db):
    subject = Subject(id=11, tenant_id=1, career_id=1, name="Análisis", year=1, allowed_turnos=[1, 3])
    db.add(subject)
    db.commit()
    db.refresh(subject)
    assert subject.allowed_turnos == [1, 3]
