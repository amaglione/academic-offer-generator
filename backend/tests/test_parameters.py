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
