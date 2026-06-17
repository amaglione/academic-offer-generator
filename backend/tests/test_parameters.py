def test_get_parameters_returns_defaults(client, auth_headers):
    r = client.get("/api/parameters", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["max_students_per_course"] == 40
    assert data["max_weekly_hours_per_professor"] == 30
    assert data["available_classrooms"] == 20
    assert data["solver_timeout_seconds"] == 600
    assert len(data["time_slots"]) > 0


def test_update_parameter_overrides_global(client, auth_headers):
    r = client.put("/api/parameters", headers=auth_headers, json={"max_students_per_course": 25})
    assert r.status_code == 200
    assert r.json()["max_students_per_course"] == 25


def test_unset_parameter_inherits_global(client, auth_headers):
    client.put("/api/parameters", headers=auth_headers, json={"max_students_per_course": 25})
    r = client.get("/api/parameters", headers=auth_headers)
    assert r.json()["max_weekly_hours_per_professor"] == 30


def test_get_parameters_includes_turnos(client, auth_headers):
    r = client.get("/api/parameters", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert "turnos" in data
    assert len(data["turnos"]) == 3
    assert data["turnos"][0]["name"] == "Turno mañana"
    assert data["turnos"][0]["start_hour"] == 8
    assert data["turnos"][0]["end_hour"] == 12
    assert data["turnos"][0]["days"] == [0, 1, 2, 3, 4]


def test_time_slots_generated_from_turnos(client, auth_headers):
    r = client.get("/api/parameters", headers=auth_headers)
    data = r.json()
    # 3 default turnos × 5 days each = 15 slots
    assert len(data["time_slots"]) == 15
    first = data["time_slots"][0]
    assert "turno_id" in first
    assert "turno_name" in first
    assert first["turno_name"] == "Turno mañana"
    assert first["start_hour"] == 8
    assert first["end_hour"] == 12
    assert first["duration_hours"] == 4


def test_generate_time_slots_function():
    from app.services.parameter_service import generate_time_slots
    turnos = [
        {"id": 1, "name": "Mañana", "start_hour": 8, "end_hour": 12, "days": [0, 5]},
    ]
    slots = generate_time_slots(turnos)
    assert len(slots) == 2
    assert slots[0]["turno_id"] == 1
    assert slots[0]["turno_name"] == "Mañana"
    assert slots[0]["day"] == 0
    assert slots[0]["day_name"] == "Lunes"
    assert slots[0]["duration_hours"] == 4
    assert slots[1]["day"] == 5
    assert slots[1]["day_name"] == "Sábado"
