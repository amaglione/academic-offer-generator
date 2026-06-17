from app.models.academic import Subject


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


def test_list_careers_returns_tenant_careers(client, auth_headers, db):
    r = client.get("/api/careers", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert any(c["name"] == "Test Career" for c in data)
    assert all("id" in c and "name" in c for c in data)


def test_list_careers_excludes_other_tenant(client, auth_headers, db):
    from app.models.tenant import Tenant
    from app.models.academic import Career
    other_tenant = Tenant(id=2, name="Other Uni", active=True)
    db.add(other_tenant)
    db.add(Career(id=99, tenant_id=2, name="Other Career"))
    db.commit()
    r = client.get("/api/careers", headers=auth_headers)
    assert r.status_code == 200
    names = [c["name"] for c in r.json()]
    assert "Other Career" not in names


def test_get_subjects_returns_subjects_with_professors(client, auth_headers, db):
    from app.models.academic import Subject, Professor, ProfessorSubject
    db.add(Professor(id=50, tenant_id=1, name="García, Juan"))
    db.add(Subject(id=20, tenant_id=1, career_id=1, name="Álgebra", year=1))
    db.add(ProfessorSubject(professor_id=50, subject_id=20))
    db.commit()
    r = client.get("/api/careers/1/subjects", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["name"] == "Álgebra"
    assert data[0]["year"] == 1
    assert data[0]["allowed_turnos"] is None
    assert len(data[0]["professors"]) == 1
    assert data[0]["professors"][0]["name"] == "García, Juan"


def test_get_subjects_404_wrong_tenant(client, auth_headers, db):
    from app.models.tenant import Tenant
    from app.models.academic import Career
    other_tenant = Tenant(id=3, name="Other Uni 3", active=True)
    db.add(other_tenant)
    db.add(Career(id=88, tenant_id=3, name="Other Career"))
    db.commit()
    r = client.get("/api/careers/88/subjects", headers=auth_headers)
    assert r.status_code == 404


def test_patch_turnos_updates_allowed_turnos(client, auth_headers, db):
    from app.models.academic import Subject
    db.add(Subject(id=30, tenant_id=1, career_id=1, name="Análisis", year=1))
    db.commit()
    r = client.patch("/api/careers/subjects/30/turnos", headers=auth_headers, json={"allowed_turnos": [1, 2]})
    assert r.status_code == 200
    data = r.json()
    assert data["allowed_turnos"] == [1, 2]
    assert data["name"] == "Análisis"


def test_patch_turnos_null_clears_restriction(client, auth_headers, db):
    from app.models.academic import Subject
    db.add(Subject(id=31, tenant_id=1, career_id=1, name="Prog", year=2, allowed_turnos=[1]))
    db.commit()
    r = client.patch("/api/careers/subjects/31/turnos", headers=auth_headers, json={"allowed_turnos": None})
    assert r.status_code == 200
    assert r.json()["allowed_turnos"] is None


def test_patch_turnos_404_wrong_tenant(client, auth_headers, db):
    from app.models.tenant import Tenant
    from app.models.academic import Career, Subject
    db.add(Tenant(id=4, name="Other Uni 4", active=True))
    db.add(Career(id=77, tenant_id=4, name="Other Career"))
    db.add(Subject(id=32, tenant_id=4, career_id=77, name="Materia Ajena", year=1))
    db.commit()
    r = client.patch("/api/careers/subjects/32/turnos", headers=auth_headers, json={"allowed_turnos": [1]})
    assert r.status_code == 404


def test_optimizer_respects_allowed_turnos():
    from app.services.optimizer import run_optimizer

    # Slot único: solo turno_id=1 (Mañana). La materia tiene allowed_turnos=[2].
    # Sin el filtro, el optimizador asigna el único slot disponible (turno_id=1)
    # y el status sería "optimal". Con el filtro no hay slots válidos → "infeasible".
    time_slots = [
        {"id": 0, "turno_id": 1, "turno_name": "Mañana", "day": 0, "day_name": "Lunes", "start_hour": 8, "end_hour": 12, "duration_hours": 4},
    ]
    professors = [{"id": 1, "name": "Prof A"}]
    demand = [{
        "subject_id": 1,
        "name": "Álgebra",
        "year": 1,
        "career_id": 1,
        "demand": 5,
        "num_courses": 1,
        "eligible_professor_ids": [1],
        "allowed_turnos": [2],  # solo turno_id=2, pero no hay slots de ese turno
    }]
    params = {
        "max_students_per_course": 40,
        "max_weekly_hours_per_professor": 30,
        "available_classrooms": 10,
        "solver_timeout_seconds": 10,
    }
    result = run_optimizer(demand, professors, time_slots, params)
    # Con el filtro, no hay slots válidos → el curso queda en unassigned_subjects con
    # reason="no_valid_slot". El solver corre sin cursos → trivialmente óptimo.
    assert result["status"] == "optimal"
    assert len(result["assignments"]) == 0
    assert len(result["unassigned_subjects"]) == 1
    assert result["unassigned_subjects"][0]["reason"] == "no_valid_slot"


def test_optimizer_allowed_turnos_assigns_correct_slot():
    from app.services.optimizer import run_optimizer

    # Dos slots: turno_id=1 y turno_id=2. La materia sólo puede ir a turno_id=2.
    time_slots = [
        {"id": 0, "turno_id": 1, "turno_name": "Mañana", "day": 0, "day_name": "Lunes", "start_hour": 8, "end_hour": 12, "duration_hours": 4},
        {"id": 1, "turno_id": 2, "turno_name": "Tarde", "day": 0, "day_name": "Lunes", "start_hour": 14, "end_hour": 18, "duration_hours": 4},
    ]
    professors = [{"id": 1, "name": "Prof A"}]
    demand = [{
        "subject_id": 1,
        "name": "Álgebra",
        "year": 1,
        "career_id": 1,
        "demand": 5,
        "num_courses": 1,
        "eligible_professor_ids": [1],
        "allowed_turnos": [2],  # solo turno tarde (id=2)
    }]
    params = {
        "max_students_per_course": 40,
        "max_weekly_hours_per_professor": 30,
        "available_classrooms": 10,
        "solver_timeout_seconds": 10,
    }
    result = run_optimizer(demand, professors, time_slots, params)
    assert result["status"] in ("optimal", "feasible")
    assert len(result["assignments"]) == 1
    # La materia debe estar en turno_id=2 (Tarde), no en turno_id=1 (Mañana)
    assert result["assignments"][0]["time_slot"]["turno_id"] == 2
